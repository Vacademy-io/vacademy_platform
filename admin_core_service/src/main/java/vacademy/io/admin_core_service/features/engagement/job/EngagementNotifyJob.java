package vacademy.io.admin_core_service.features.engagement.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementNotificationLog;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementNotificationLogRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.admin_core_service.features.engagement.service.EngagementScheduleResolver;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Sends the "your task is live" push.
 *
 * Runs every 15 minutes rather than at a fixed hour because each plan carries its own
 * timezone and its own notify time — a single daily trigger could only ever be right
 * for one zone. Each tick asks every published plan "did one of your slots reach its
 * notify time in YOUR zone during the last 15 minutes".
 *
 * <p>Two layers stop duplicates, and both are needed: {@code @SchedulerLock} keeps the
 * four production replicas from running the same tick, and the unique index behind
 * {@code engagement_notification_log} keeps a restart or a clock adjustment from
 * replaying a window that already fired. A duplicate 6 AM push to a whole batch is how
 * an app gets muted.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class EngagementNotifyJob {

    /** Must match the @Scheduled interval below — it defines the "did it fire" window. */
    private static final int TICK_MINUTES = 15;

    private static final List<String> ACTIVE_STATUSES = List.of("ACTIVE");

    private final EngagementPlanRepository planRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementItemRepository itemRepository;
    private final EngagementNotificationLogRepository notificationLogRepository;
    private final EngagementScheduleResolver scheduleResolver;
    private final StudentSessionInstituteGroupMappingRepository enrollmentRepository;
    private final NotificationService notificationService;

    @Scheduled(cron = "0 0/15 * * * ?")
    @SchedulerLock(name = "EngagementNotifyTick", lockAtMostFor = "PT14M", lockAtLeastFor = "PT30S")
    public void tick() {
        List<EngagementPlan> plans;
        try {
            plans = planRepository.findAllPublished();
        } catch (Exception e) {
            log.error("[engagement-notify] could not load published plans — tick aborted", e);
            return;
        }
        if (plans.isEmpty()) return;

        for (EngagementPlan plan : plans) {
            try {
                notifyForPlan(plan);
            } catch (Exception e) {
                // One bad plan must not stop the rest of the institutes' pushes.
                log.error("[engagement-notify] plan {} failed", plan.getId(), e);
            }
        }
    }

    private void notifyForPlan(EngagementPlan plan) {
        ZonedDateTime now = scheduleResolver.nowIn(plan);
        LocalDate today = now.toLocalDate();
        LocalTime windowEnd = now.toLocalTime();
        LocalTime windowStart = windowEnd.minusMinutes(TICK_MINUTES);

        // A window that wrapped past midnight would need the previous local day too;
        // skip it rather than mis-send. The next tick covers it correctly.
        if (windowStart.isAfter(windowEnd)) return;

        List<EngagementSlot> slots =
                slotRepository.findDueForNotification(today, windowStart, windowEnd);
        if (slots.isEmpty()) return;

        for (EngagementSlot slot : slots) {
            if (!plan.getId().equals(slot.getPlanId())) continue;
            if (!scheduleResolver.runsOn(slot, today)) continue;
            if (notificationLogRepository.existsBySlotIdAndRunDate(slot.getId(), today)) continue;

            List<EngagementItem> items = itemRepository.findActiveBySlot(slot.getId());
            if (items.isEmpty()) continue;

            List<String> userIds = enrollmentRepository
                    .findDistinctUserIdsByPackageSessionAndStatus(
                            plan.getPackageSessionId(), ACTIVE_STATUSES);
            if (userIds == null || userIds.isEmpty()) continue;

            // Claim the send BEFORE dispatching. If the push then fails, nobody gets a
            // duplicate on the next tick — the opposite order risks sending twice,
            // which is the worse failure for a daily notification.
            if (!claim(slot, plan, today, userIds.size())) continue;

            String title = items.size() == 1
                    ? items.get(0).getTitle()
                    : items.size() + " tasks are live";
            String body = items.size() == 1
                    ? "Your task for today is ready — tap to start."
                    : "Your tasks for today are ready — tap to start.";

            try {
                notificationService.sendPushViaUnified(
                        plan.getInstituteId(), userIds, title, body,
                        Map.of("type", "ENGAGEMENT", "slotId", slot.getId()));
                log.info("[engagement-notify] slot {} pushed to {} learners", slot.getId(), userIds.size());
            } catch (Exception e) {
                log.error("[engagement-notify] push failed for slot {}", slot.getId(), e);
            }
        }
    }

    /** Returns false when another replica or an earlier tick already claimed this send. */
    private boolean claim(EngagementSlot slot, EngagementPlan plan, LocalDate runDate, int recipients) {
        EngagementNotificationLog entry = new EngagementNotificationLog();
        entry.setSlotId(slot.getId());
        entry.setRunDate(runDate);
        entry.setInstituteId(plan.getInstituteId());
        entry.setRecipients(recipients);
        entry.setSentAt(new Timestamp(System.currentTimeMillis()));
        try {
            notificationLogRepository.saveAndFlush(entry);
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }
}
