package vacademy.io.admin_core_service.features.engagement.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEnums;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.admin_core_service.features.engagement.service.EngagementScheduleResolver;
import vacademy.io.admin_core_service.features.points_ledger.entity.PointsSourceType;
import vacademy.io.admin_core_service.features.points_ledger.service.PointsLedgerService;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;

/**
 * Pays out the correctness bonuses that were held back from learners whose item hides
 * its result until the reveal.
 *
 * Those learners were awarded completion points only at submit — landing the bonus
 * immediately would have told them they answered correctly, which is the secret the
 * reveal time exists to keep. Once the reveal passes there is nothing left to protect,
 * so the bonus is paid and the attempt's recorded points catch up.
 *
 * <p>Runs every 15 minutes because reveal times are per-slot wall-clock in each
 * institute's own zone. Re-running is free: the ledger's idempotency key makes a
 * second pass a no-op, and the attempt update is idempotent by construction.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class EngagementRevealJob {

    /** How far back to look. A slot revealed days ago has long since been settled. */
    private static final int LOOKBACK_DAYS = 3;

    private final EngagementPlanRepository planRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementItemRepository itemRepository;
    private final EngagementAttemptRepository attemptRepository;
    private final EngagementScheduleResolver scheduleResolver;
    private final PointsLedgerService pointsLedgerService;

    @Scheduled(cron = "0 5/15 * * * ?")
    @SchedulerLock(name = "EngagementRevealTick", lockAtMostFor = "PT14M", lockAtLeastFor = "PT30S")
    public void tick() {
        List<EngagementPlan> plans;
        try {
            plans = planRepository.findAllPublished();
        } catch (Exception e) {
            log.error("[engagement-reveal] could not load published plans — tick aborted", e);
            return;
        }

        for (EngagementPlan plan : plans) {
            try {
                settleForPlan(plan);
            } catch (Exception e) {
                // One bad plan must not stop every other institute's payouts.
                log.error("[engagement-reveal] plan {} failed", plan.getId(), e);
            }
        }
    }

    private void settleForPlan(EngagementPlan plan) {
        LocalDate today = LocalDate.now(scheduleResolver.zoneOf(plan));

        for (EngagementSlot slot : slotRepository.findActiveByPlan(plan.getId())) {
            for (int back = 0; back <= LOOKBACK_DAYS; back++) {
                LocalDate runDate = today.minusDays(back);
                if (!scheduleResolver.runsOn(slot, runDate)) continue;
                if (!scheduleResolver.isRevealed(plan, slot, runDate)) continue;

                for (EngagementItem item : itemRepository.findActiveBySlot(slot.getId())) {
                    if (!Boolean.TRUE.equals(item.getHideResultUntilReveal())) continue;
                    int bonus = item.getCorrectPoints() == null ? 0 : item.getCorrectPoints();
                    if (bonus <= 0) continue;
                    java.time.Instant revealAt = java.time.LocalDateTime
                            .of(runDate, slot.effectiveRevealTime())
                            .atZone(scheduleResolver.zoneOf(plan)).toInstant();
                    settleItem(plan, item, bonus, revealAt);
                }
            }
        }
    }

    private void settleItem(EngagementPlan plan, EngagementItem item, int fullBonus,
                            java.time.Instant revealAt) {
        for (EngagementAttempt attempt : attemptRepository.findByItem(item.getId())) {
            if (!EngagementEnums.AttemptStatus.COMPLETED.name().equals(attempt.getStatus())) continue;
            if (!Boolean.TRUE.equals(attempt.getIsCorrect())) continue;
            // Answered after the reveal: submit already paid completion only, and the
            // answer was public by then. Without this a learner answering in the gap
            // before this job's next tick still collected the bonus.
            if (attempt.getCompletedAt() != null
                    && !attempt.getCompletedAt().toInstant().isBefore(revealAt)) continue;
            // A late (catch-up) answer earns the bonus at the same reduced rate as the
            // completion points it was paid at submit.
            int bonus = Boolean.TRUE.equals(attempt.getIsLate())
                    ? (int) Math.floor(fullBonus * (scheduleResolver.resolveCatchUpPercent(plan, item) / 100.0))
                    : fullBonus;
            if (bonus <= 0) continue;

            boolean awarded = pointsLedgerService.award(
                    attempt.getUserId(),
                    attempt.getInstituteId(),
                    attempt.getPackageSessionId(),
                    PointsSourceType.ENGAGEMENT_ITEM,
                    item.getId(),
                    bonus,
                    "Correct answer — " + item.getTitle(),
                    // Distinct from the submit-time award for the same item, so both
                    // can exist and neither can be paid twice.
                    // Keyed on the version the learner ANSWERED, not the item's current
                    // one: an in-place edit bumps item.version, and keying on that would
                    // pay every correct learner a second time.
                    "ENGAGEMENT_BONUS:" + item.getId() + ":v"
                            + (attempt.getItemVersion() == null ? item.getVersion() : attempt.getItemVersion())
                            + ":" + attempt.getUserId()).isPresent();

            if (awarded) {
                // Keep the attempt's own figure honest for the tracking table.
                attempt.setPointsAwarded(
                        (attempt.getPointsAwarded() == null ? 0 : attempt.getPointsAwarded()) + bonus);
                attempt.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
                attemptRepository.save(attempt);
                log.info("[engagement-reveal] bonus {} paid to {} for item {}",
                        bonus, attempt.getUserId(), item.getId());
            }
        }
    }
}
