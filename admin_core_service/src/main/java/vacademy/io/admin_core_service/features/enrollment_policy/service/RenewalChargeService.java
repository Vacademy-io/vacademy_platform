package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.UserInstitutePaymentGatewayMappingService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.payment.enums.PaymentType;

import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * Auto-charge engine for autopay subscriptions. Invoked daily by
 * {@code PackageSessionScheduler.emitRenewalCharges}. Only ACTIVE plans with
 * {@code auto_renewal_enabled = true} and {@code next_charge_at <= now} are
 * touched (see {@code UserPlanRepository.findDueForRenewal}), so no pre-existing
 * / non-autopay plan is ever charged.
 *
 * Per plan: charge the stored mandate off-session, then
 *  - synchronous gateways (eWay) → confirm + extend inline;
 *  - webhook gateways (Razorpay) → leave PENDING; the RENEWAL webhook extends.
 * On failure: dunning — retry daily up to maxAttempts, then expire.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RenewalChargeService {

    private final UserPlanRepository userPlanRepository;
    private final PaymentService paymentService;
    private final UserInstitutePaymentGatewayMappingService mandateService;
    private final RenewalPaymentService renewalPaymentService;
    private final vacademy.io.admin_core_service.features.plan_change.service.PlanChangeService planChangeService;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final AuthService authService;

    /** Default dunning ceiling when the plan/policy doesn't specify one. */
    private static final int DEFAULT_MAX_ATTEMPTS = 3;

    public void processDueRenewals() {
        Date now = new Date();
        // next_charge_at carries the enrollment's time-of-day, so a plan due "today" at
        // 15:00 would be missed by this morning's run and only charge tomorrow. Sweep the
        // whole day so a plan is always charged on the date it falls due.
        List<UserPlan> due = userPlanRepository.findDueForRenewal(endOfDay(now));
        if (due.isEmpty()) {
            log.info("[RenewalCharge] No autopay plans due");
            return;
        }
        log.info("[RenewalCharge] {} autopay plan(s) due", due.size());
        int charged = 0, failed = 0, skipped = 0;
        for (UserPlan plan : due) {
            try {
                Outcome outcome = processOne(plan, now);
                switch (outcome) {
                    case CHARGED -> charged++;
                    case FAILED -> failed++;
                    default -> skipped++;
                }
            } catch (Exception e) {
                failed++;
                log.error("[RenewalCharge] Unexpected error for plan {}: {}", plan.getId(), e.getMessage(), e);
            }
        }
        log.info("[RenewalCharge] Done — charged={} failed={} skipped={}", charged, failed, skipped);
    }

    /**
     * TEST-ONLY: force a renewal charge for a single plan NOW, bypassing the
     * next_charge_at date filter, so autopay can be verified on demand instead of
     * waiting for the trial/cycle to elapse. Runs the exact same processOne path
     * the scheduler uses. Remove/secure the calling endpoint before prod.
     */
    public String chargeNow(String userPlanId) {
        java.util.List<UserPlan> plans = userPlanRepository.findByIdsWithoutPaymentLogs(java.util.List.of(userPlanId));
        if (plans.isEmpty()) {
            return "PLAN_NOT_FOUND: " + userPlanId;
        }
        UserPlan plan = plans.get(0);
        // processOne's atomic claim needs next_charge_at to be set; arm it to now
        // if the caller is testing a plan whose charge date hasn't arrived yet.
        if (plan.getNextChargeAt() == null) {
            plan.setNextChargeAt(new Date());
            userPlanRepository.save(plan);
        }
        try {
            Outcome o = processOne(plan, new Date());
            return "userPlan=" + userPlanId + " outcome=" + o;
        } catch (Exception e) {
            log.error("[RenewalCharge] chargeNow failed for {}: {}", userPlanId, e.getMessage(), e);
            return "ERROR: " + e.getMessage();
        }
    }

    /**
     * True when a fixed-term subscription has run its full duration. The term is
     * AUTOPAY_SETTING.TOTAL_DURATION_MONTHS on the invite, measured from the plan's
     * start_date. Open-ended (no/invalid setting) always returns false.
     */
    private boolean hasReachedSubscriptionTerm(UserPlan plan, EnrollInvite invite, Date now) {
        Integer months = readTotalDurationMonths(invite);
        if (months == null || months <= 0 || plan.getStartDate() == null) {
            return false;
        }
        java.time.LocalDate start = plan.getStartDate().toInstant()
                .atZone(java.time.ZoneId.systemDefault()).toLocalDate();
        java.time.LocalDate termEnd = start.plusMonths(months);
        java.time.LocalDate today = now.toInstant()
                .atZone(java.time.ZoneId.systemDefault()).toLocalDate();
        // On/after the term-end date the next cycle would fall outside the paid term.
        return !today.isBefore(termEnd);
    }

    private Integer readTotalDurationMonths(EnrollInvite invite) {
        return readAutopayInt(invite, "TOTAL_DURATION_MONTHS");
    }

    private Integer readGracePeriodDays(EnrollInvite invite) {
        return readAutopayInt(invite, "GRACE_PERIOD_DAYS");
    }

    /** Reads an integer AUTOPAY_SETTING key off the invite's settingJson; null if absent. */
    private Integer readAutopayInt(EnrollInvite invite, String key) {
        if (invite == null || !StringUtils.hasText(invite.getSettingJson())) {
            return null;
        }
        try {
            com.fasterxml.jackson.databind.JsonNode ap = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(invite.getSettingJson()).path("setting").path("AUTOPAY_SETTING");
            if (ap.has(key) && !ap.get(key).isNull()) {
                return ap.get(key).asInt();
            }
        } catch (Exception e) {
            log.warn("[RenewalCharge] Could not read {} for invite {}: {}",
                    key, invite.getId(), e.getMessage());
        }
        return null;
    }

    /** Last instant of the given day, so "due today" means due by this run. */
    private static Date endOfDay(Date date) {
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.setTime(date);
        cal.set(java.util.Calendar.HOUR_OF_DAY, 23);
        cal.set(java.util.Calendar.MINUTE, 59);
        cal.set(java.util.Calendar.SECOND, 59);
        cal.set(java.util.Calendar.MILLISECOND, 999);
        return cal.getTime();
    }

    private enum Outcome { CHARGED, FAILED, SKIPPED }

    /**
     * One plan at a time. Each Spring-Data save commits independently and the
     * gateway charge (PaymentService) + confirmation (RenewalPaymentService) run
     * in their own transactions, so one plan's failure never affects another.
     * The attempt-bump + disarm is committed BEFORE the charge to make
     * double-charging on a duplicate scheduler run impossible.
     */
    private Outcome processOne(UserPlan plan, Date now) {
        EnrollInvite invite = plan.getEnrollInvite();
        if (invite == null || !StringUtils.hasText(invite.getInstituteId())) {
            log.warn("[RenewalCharge] Plan {} has no institute — skipping", plan.getId());
            return Outcome.SKIPPED;
        }
        String instituteId = invite.getInstituteId();
        String vendor = invite.getVendor();
        if (!StringUtils.hasText(vendor) || "MANUAL".equalsIgnoreCase(vendor)) {
            log.info("[RenewalCharge] Plan {} vendor={} not chargeable — skipping", plan.getId(), vendor);
            return Outcome.SKIPPED;
        }

        // Fixed-term subscription: once the configured total duration has elapsed, stop
        // charging and turn autopay off. The learner keeps access until the current
        // period's end_date, then it lapses naturally — we don't revoke here.
        if (hasReachedSubscriptionTerm(plan, invite, now)) {
            log.info("[RenewalCharge] Plan {} reached its total subscription term — stopping autopay", plan.getId());
            plan.setAutoRenewalEnabled(false);
            plan.setNextChargeAt(null);
            userPlanRepository.save(plan);
            return Outcome.SKIPPED;
        }

        MandateInfo mandate = mandateService.getMandateOrLegacyToken(plan.getUserId(), instituteId, vendor, plan.getId());
        if (mandate == null || !MandateInfo.STATUS_ACTIVE.equalsIgnoreCase(mandate.getStatus())) {
            log.warn("[RenewalCharge] Plan {} has no ACTIVE mandate/token — skipping (needs registration/backfill)",
                    plan.getId());
            return Outcome.SKIPPED;
        }

        double amount = resolveAmount(plan);
        if (amount <= 0) {
            log.warn("[RenewalCharge] Plan {} has non-positive amount — skipping", plan.getId());
            return Outcome.SKIPPED;
        }
        String currency = StringUtils.hasText(invite.getCurrency()) ? invite.getCurrency()
                : (mandate.getCurrency() != null ? mandate.getCurrency() : "INR");

        UserDTO user = getUser(plan.getUserId());
        if (user == null) {
            log.warn("[RenewalCharge] Plan {} — user {} not found — skipping", plan.getId(), plan.getUserId());
            return Outcome.SKIPPED;
        }

        // Atomically CLAIM this plan for this cycle BEFORE calling the gateway.
        // The daily scheduler fires on every replica, so only the replica whose
        // UPDATE flips next_charge_at→null (rows-affected = 1) proceeds; the rest
        // skip. This is the multi-replica double-charge guard.
        Date reArmAt = plan.getNextChargeAt();
        if (userPlanRepository.claimForRenewal(plan.getId(), now) == 0) {
            log.info("[RenewalCharge] Plan {} already claimed by another replica — skipping", plan.getId());
            return Outcome.SKIPPED;
        }
        // Reflect the atomic claim in the in-memory entity for downstream logic.
        plan.setNextChargeAt(null);
        plan.setLastRenewalAttemptAt(now);
        plan.setRenewalAttemptCount((plan.getRenewalAttemptCount() == null ? 0 : plan.getRenewalAttemptCount()) + 1);

        PaymentInitiationRequestDTO request = new PaymentInitiationRequestDTO();
        request.setAmount(amount);
        request.setCurrency(currency);
        request.setVendor(vendor);
        request.setVendorId(invite.getVendorId());
        request.setEmail(user.getEmail());
        request.setInstituteId(instituteId);
        request.setPaymentType(PaymentType.RENEWAL);
        // Razorpay's recurring-payment API requires a contact, and it must be a real
        // phone number (digits and + only). It used to be filled from vendorId -- the
        // invite's gateway id, literally "RAZORPAY" -- so every auto-charge was rejected
        // with "Contact number contains invalid characters" before it ever reached the
        // mandate, and the failure took its own payment_log down with it (PaymentService
        // is @Transactional), leaving only a rising renewal_attempt_count as evidence.
        vacademy.io.common.payment.dto.RazorpayRequestDTO razorpayRequest =
                new vacademy.io.common.payment.dto.RazorpayRequestDTO();
        if (StringUtils.hasText(user.getMobileNumber())) {
            razorpayRequest.setContact(user.getMobileNumber().replaceAll("[^0-9+]", ""));
        }
        request.setRazorpayRequest(razorpayRequest);

        try {
            PaymentResponseDTO response = paymentService.handleRecurringCharge(
                    user, instituteId, vendor, request, plan, mandate);

            if (isSyncSuccess(response)) {
                // eWay / any gateway that confirms synchronously — extend now.
                renewalPaymentService.handleRenewalPaymentConfirmation(
                        response.getOrderId(), instituteId, PaymentStatusEnum.PAID, response);
                log.info("[RenewalCharge] Plan {} charged + confirmed (sync)", plan.getId());
                return Outcome.CHARGED;
            }
            // Webhook gateways (Razorpay): submitted, awaiting RENEWAL webhook to
            // extend. next_charge_at stays null so we don't re-charge meanwhile.
            log.info("[RenewalCharge] Plan {} charge submitted — awaiting webhook confirmation", plan.getId());
            return Outcome.CHARGED;
        } catch (Exception e) {
            log.warn("[RenewalCharge] Plan {} charge failed (attempt {}): {}",
                    plan.getId(), plan.getRenewalAttemptCount(), e.getMessage());
            applyDunning(plan, reArmAt, now, instituteId);
            return Outcome.FAILED;
        }
    }

    /**
     * Failed charge: retry tomorrow up to maxAttempts, then expire the plan and
     * deactivate access. Reuses the same EXPIRED semantics as the enrolment
     * processor.
     */
    private void applyDunning(UserPlan plan, Date reArmAt, Date now, String instituteId) {
        int maxAttempts = resolveMaxAttempts(plan);
        // Access is retained while we retry. The grace period (AUTOPAY_SETTING.
        // GRACE_PERIOD_DAYS) extends that window: keep access and keep retrying until
        // the due date + grace has passed, THEN revoke. With no grace configured we fall
        // back to the attempt ceiling alone.
        Integer graceDays = readGracePeriodDays(plan.getEnrollInvite());
        boolean graceConfigured = graceDays != null && graceDays > 0 && reArmAt != null;
        boolean exhausted;
        if (graceConfigured) {
            // Grace governs: retry daily throughout the window, revoke only once the due
            // date + grace has passed — regardless of attempt count.
            Calendar deadline = Calendar.getInstance();
            deadline.setTime(reArmAt);
            deadline.add(Calendar.DAY_OF_MONTH, graceDays);
            exhausted = !now.before(deadline.getTime());
        } else {
            exhausted = plan.getRenewalAttemptCount() >= maxAttempts;
        }
        if (exhausted) {
            plan.setStatus(UserPlanStatusEnum.EXPIRED.name());
            plan.setNextChargeAt(null);
            userPlanRepository.save(plan);
            deactivateMappings(plan);
            // Failure notification (dunning) — reuse the confirmation handler's FAILED path.
            String vendor = plan.getEnrollInvite() != null ? plan.getEnrollInvite().getVendor() : null;
            log.warn("[RenewalCharge] Plan {} exhausted {} attempts — expired (vendor={})",
                    plan.getId(), maxAttempts, vendor);
        } else {
            // Retry tomorrow.
            Calendar c = Calendar.getInstance();
            c.setTime(now);
            c.add(Calendar.DAY_OF_MONTH, 1);
            plan.setNextChargeAt(c.getTime());
            userPlanRepository.save(plan);
            log.info("[RenewalCharge] Plan {} will retry on {}", plan.getId(), c.getTime());
        }
        // Let workflows react (dunning WhatsApp/email, admin alerts). Never blocks the money path.
        renewalPaymentService.emitRenewalPaymentFailed(plan, instituteId, exhausted);
    }

    private void deactivateMappings(UserPlan plan) {
        List<StudentSessionInstituteGroupMapping> mappings =
                mappingRepository.findByUserPlanIdAndStatus(plan.getId(), LearnerSessionStatusEnum.ACTIVE.name());
        for (StudentSessionInstituteGroupMapping m : mappings) {
            m.setStatus(LearnerSessionStatusEnum.INACTIVE.name());
            mappingRepository.save(m);
        }
    }

    private boolean isSyncSuccess(PaymentResponseDTO response) {
        if (response == null || response.getResponseData() == null) {
            return false;
        }
        Map<String, Object> d = response.getResponseData();
        Object paymentStatus = d.get("paymentStatus");
        if (paymentStatus != null && PaymentStatusEnum.PAID.name().equalsIgnoreCase(paymentStatus.toString())) {
            return true;
        }
        Object status = d.get("status");
        return status != null && ("succeeded".equalsIgnoreCase(status.toString())
                || "captured".equalsIgnoreCase(status.toString()));
    }

    /**
     * What to charge this cycle. A downgrade booked for the end of the cycle lands at
     * exactly this renewal, so the learner is billed the plan they are moving TO — charging
     * the old price here would take money for a plan they will not be on the moment the
     * charge settles.
     */
    private double resolveAmount(UserPlan plan) {
        PaymentPlan pending = planChangeService.pendingTargetPlan(plan);
        if (pending != null) {
            log.info("[RenewalCharge] Plan {} has a scheduled change — charging target plan {} ({})",
                    plan.getId(), pending.getId(), pending.getActualPrice());
            return pending.getActualPrice();
        }
        PaymentPlan pp = plan.getPaymentPlan();
        return pp != null ? pp.getActualPrice() : 0.0;
    }

    private int resolveMaxAttempts(UserPlan plan) {
        // Policy-driven override is read at enrollment time onto the plan snapshot;
        // fall back to the default ceiling here.
        return DEFAULT_MAX_ATTEMPTS;
    }

    private UserDTO getUser(String userId) {
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            return users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            log.error("[RenewalCharge] Failed to load user {}: {}", userId, e.getMessage());
            return null;
        }
    }
}
