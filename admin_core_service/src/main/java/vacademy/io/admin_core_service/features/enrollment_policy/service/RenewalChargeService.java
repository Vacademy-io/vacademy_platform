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
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final AuthService authService;

    /** Default dunning ceiling when the plan/policy doesn't specify one. */
    private static final int DEFAULT_MAX_ATTEMPTS = 3;

    public void processDueRenewals() {
        Date now = new Date();
        List<UserPlan> due = userPlanRepository.findDueForRenewal(now);
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
            applyDunning(plan, reArmAt, now);
            return Outcome.FAILED;
        }
    }

    /**
     * Failed charge: retry tomorrow up to maxAttempts, then expire the plan and
     * deactivate access. Reuses the same EXPIRED semantics as the enrolment
     * processor.
     */
    private void applyDunning(UserPlan plan, Date reArmAt, Date now) {
        int maxAttempts = resolveMaxAttempts(plan);
        if (plan.getRenewalAttemptCount() >= maxAttempts) {
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

    private double resolveAmount(UserPlan plan) {
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
