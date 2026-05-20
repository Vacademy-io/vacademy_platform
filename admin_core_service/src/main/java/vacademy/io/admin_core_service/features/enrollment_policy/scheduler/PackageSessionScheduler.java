package vacademy.io.admin_core_service.features.enrollment_policy.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.enrollment_policy.service.PackageSessionEnrolmentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PackageSessionScheduler {

    private final PackageSessionEnrolmentService enrolmentService;
    private final UserPlanRepository userPlanRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final WorkflowExecutionRepository workflowExecutionRepository;

    /**
     * Pre-existing manual-trigger entry point for enrolment-policy actions
     * (expire / graduate active UserPlans). Currently invoked only from
     * {@code TestEnrollMentController} — intentionally not auto-scheduled.
     * Leaving unchanged to avoid activating dormant destructive behaviour.
     */
    public void processPackageSessionExpiries() {
        log.info("Starting PackageSessionScheduler job...");
        try {
            enrolmentService.processActiveEnrollments();
        } catch (Exception e) {
            log.error("Error during scheduled package session processing", e);
        }
        log.info("PackageSessionScheduler job finished.");
    }

    // ─── Membership-expiry workflow trigger ────────────────────────────────
    //
    // Daily scan that fires the MEMBERSHIP_EXPIRY workflow trigger once per
    // user plan that's about to expire — paired with the Settings →
    // Automations "Remind learners before their access expires" recipe.
    //
    // Hosted here (alongside the existing enrolment scheduler) instead of in a
    // dedicated Quartz job because (a) the work is a one-line repository
    // scan, (b) all other periodic work in this codebase uses Spring's
    // @Scheduled annotation, and (c) Quartz is reserved for the workflow
    // engine and the live-session processor.

    /** Reminder window: plans whose end_date is within this many days. */
    private static final int DAYS_BEFORE_EXPIRY = 7;

    /**
     * Dedup look-back for the {@code workflow_execution} idempotency-key
     * scan — large enough to cover the reminder window plus margin, small
     * enough that a re-purchased plan eventually re-qualifies.
     */
    private static final int DEDUP_WINDOW_DAYS = 30;

    /**
     * Fires MEMBERSHIP_EXPIRY for plans entering the reminder window.
     * Dedup is two-layer: (1) this method checks workflow_execution for a
     * prior emission for the same plan and skips if found, keeping logs
     * quiet; (2) the EVENT_BASED idempotency strategy on MEMBERSHIP_EXPIRY
     * triggers (see {@code WorkflowBuilderService.isPeriodicScanTrigger})
     * gives a stable idempotency key, so even if two replicas race, the
     * UNIQUE constraint on {@code workflow_execution.idempotency_key}
     * rejects the duplicate at the DB layer.
     * <p>
     * The institute is resolved off the joined EnrollInvite. Plans without
     * one (legacy direct subscriptions) are skipped with a debug log — they
     * need a separate path before we can route their trigger to an
     * institute's workflow.
     */
    @Scheduled(cron = "0 0 9 * * ?")  // 09:00 every day, server timezone
    public void emitMembershipExpiryReminders() {
        Date now = new Date();
        Date cutoff = Date.from(LocalDate.now().plusDays(DAYS_BEFORE_EXPIRY)
                .atStartOfDay(ZoneId.systemDefault()).toInstant());
        Instant dedupSince = Instant.now().minus(DEDUP_WINDOW_DAYS, ChronoUnit.DAYS);

        List<UserPlan> due = userPlanRepository.findActivePlansExpiringSoon(now, cutoff);
        if (due.isEmpty()) {
            log.info("[MembershipExpiry] No plans within {}-day reminder window", DAYS_BEFORE_EXPIRY);
            return;
        }
        log.info("[MembershipExpiry] Found {} plan(s) within reminder window", due.size());

        int fired = 0;
        int skippedAlreadyNotified = 0;
        int skippedNoInstitute = 0;

        for (UserPlan plan : due) {
            String instituteId = plan.getEnrollInvite() != null
                    ? plan.getEnrollInvite().getInstituteId()
                    : null;
            if (instituteId == null || instituteId.isBlank()) {
                skippedNoInstitute++;
                log.debug("[MembershipExpiry] Skipping plan {} — no institute resolvable", plan.getId());
                continue;
            }

            // Application-level dedup against the EVENT_BASED key format
            // produced by EventBasedKeyGenerator:
            //   trigger_<triggerId>_eventType_<eventName>_eventId_<eventId>
            String keyPattern = "%eventType_"
                    + WorkflowTriggerEvent.MEMBERSHIP_EXPIRY.name()
                    + "_eventId_" + plan.getId() + "%";
            if (workflowExecutionRepository.countByIdempotencyKeyLikeSince(keyPattern, dedupSince) > 0) {
                skippedAlreadyNotified++;
                log.debug("[MembershipExpiry] Skipping plan {} — already notified in last {} days",
                        plan.getId(), DEDUP_WINDOW_DAYS);
                continue;
            }

            try {
                long daysToExpiry = (plan.getEndDate().getTime() - now.getTime())
                        / (1000L * 60 * 60 * 24);
                Map<String, Object> ctx = new HashMap<>();
                ctx.put("userPlanId", plan.getId());
                ctx.put("userId", plan.getUserId());
                ctx.put("paymentPlanId", plan.getPaymentPlanId());
                ctx.put("enrollInviteId", plan.getEnrollInviteId());
                ctx.put("endDate", plan.getEndDate().toString());
                ctx.put("daysToExpiry", daysToExpiry);

                workflowTriggerService.handleTriggerEvents(
                        WorkflowTriggerEvent.MEMBERSHIP_EXPIRY.name(),
                        plan.getId(),
                        instituteId,
                        ctx);
                fired++;
            } catch (Exception ex) {
                log.warn("[MembershipExpiry] Failed to fire trigger for plan {}: {}",
                        plan.getId(), ex.getMessage());
            }
        }

        log.info("[MembershipExpiry] Done — fired={} skippedAlreadyNotified={} skippedNoInstitute={}",
                fired, skippedAlreadyNotified, skippedNoInstitute);
    }
}
