package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.MandateInfo;
import vacademy.io.admin_core_service.features.user_subscription.dto.SubscriptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Learner self-service for subscriptions + autopay mandates: list the learner's
 * subscriptions and cancel autopay. Cancelling revokes the mandate and stops
 * future charges but NEVER cuts access early — the learner keeps access until
 * end_date (status CANCELED makes the enrolment processor expire exactly at
 * end_date, no grace). All operations are scoped to the JWT user id.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final UserPlanRepository userPlanRepository;
    private final UserInstitutePaymentGatewayMappingService mandateService;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final WorkflowTriggerService workflowTriggerService;
    private final vacademy.io.admin_core_service.features.payments.service.PaymentService paymentService;
    private final vacademy.io.admin_core_service.features.auth_service.service.AuthService authService;

    private static final List<String> VISIBLE_STATUSES = List.of(
            UserPlanStatusEnum.ACTIVE.name(),
            UserPlanStatusEnum.CANCELED.name(),
            UserPlanStatusEnum.PAYMENT_FAILED.name(),
            // Dunning-expired plans stay visible so the learner can pay manually
            // and reactivate the same membership (renewal payment flow).
            UserPlanStatusEnum.EXPIRED.name());

    public List<SubscriptionDTO> listSubscriptions(String userId, String instituteId) {
        List<UserPlan> plans = userPlanRepository.findAllByUserIdAndInstituteIdAndStatusIn(
                userId, instituteId, VISIBLE_STATUSES);
        return plans.stream().map(p -> toDto(p, userId, instituteId)).toList();
    }

    /**
     * Cancel autopay for a plan. Revokes the mandate, turns off auto-renewal and
     * marks the plan CANCELED (access continues until end_date). Idempotent.
     */
    @Transactional
    public SubscriptionDTO cancelSubscription(String userId, String instituteId, String userPlanId) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("Subscription not found: " + userPlanId));
        if (!userId.equals(plan.getUserId())) {
            throw new VacademyException("Subscription does not belong to the current user");
        }

        String vendor = resolveVendor(plan);
        if (StringUtils.hasText(vendor)) {
            mandateService.revokeMandate(userId, instituteId, vendor, userPlanId);
        }

        plan.setAutoRenewalEnabled(false);
        plan.setStatus(UserPlanStatusEnum.CANCELED.name());
        userPlanRepository.save(plan);
        log.info("Cancelled autopay for plan {} (user {}); access retained until {}",
                userPlanId, userId, plan.getEndDate());

        // Same SUBSCRIPTION_CANCELLED trigger the admin cancel path fires
        // (UserPlanService.cancelUserPlan) so cancel-reaction workflows cover
        // learner self-service too. Wrapped so a workflow failure can't undo the cancel.
        try {
            Map<String, Object> ctx = new HashMap<>();
            ctx.put("userPlanId", plan.getId());
            ctx.put("userId", plan.getUserId());
            ctx.put("enrollInviteId", plan.getEnrollInviteId());
            ctx.put("paymentPlanId", plan.getPaymentPlanId());
            ctx.put("endDate", plan.getEndDate() != null ? plan.getEndDate().toString() : null);
            ctx.put("selfService", true);
            String eventId = plan.getEnrollInviteId() != null ? plan.getEnrollInviteId() : instituteId;
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.SUBSCRIPTION_CANCELLED.name(), eventId, instituteId, ctx);
        } catch (Exception wfe) {
            log.warn("Failed to trigger SUBSCRIPTION_CANCELLED workflow for plan {}: {}",
                    userPlanId, wfe.getMessage());
        }

        return toDto(plan, userId, instituteId);
    }

    private SubscriptionDTO toDto(UserPlan plan, String userId, String instituteId) {
        String vendor = resolveVendor(plan);
        MandateInfo mandate = StringUtils.hasText(vendor)
                ? mandateService.getMandate(userId, instituteId, vendor, plan.getId())
                : null;
        boolean liveMandate = mandate != null
                && MandateInfo.STATUS_ACTIVE.equalsIgnoreCase(mandate.getStatus());

        List<String> packageSessionIds = mappingRepository
                .findByUserPlanIdAndStatus(plan.getId(), LearnerSessionStatusEnum.ACTIVE.name())
                .stream()
                .map(StudentSessionInstituteGroupMapping::getPackageSession)
                .filter(ps -> ps != null)
                .map(ps -> ps.getId())
                .distinct()
                .toList();

        // Manual renewal is offered whenever autopay will NOT charge this plan:
        // cancelled/failed/expired plans, or an active plan whose mandate is gone.
        boolean canRenewManually = !liveMandate
                || UserPlanStatusEnum.CANCELED.name().equals(plan.getStatus())
                || UserPlanStatusEnum.PAYMENT_FAILED.name().equals(plan.getStatus())
                || UserPlanStatusEnum.EXPIRED.name().equals(plan.getStatus());
        String currency = mandate != null && mandate.getCurrency() != null
                ? mandate.getCurrency()
                : (plan.getEnrollInvite() != null ? plan.getEnrollInvite().getCurrency() : null);

        return SubscriptionDTO.builder()
                .userPlanId(plan.getId())
                .planName(plan.getPaymentPlan() != null ? plan.getPaymentPlan().getName() : null)
                .status(plan.getStatus())
                .endDate(plan.getEndDate())
                .nextChargeAt(plan.getNextChargeAt())
                .autoRenewalEnabled(plan.getAutoRenewalEnabled())
                .isTrial(plan.getIsTrial())
                .vendor(vendor)
                .mandateStatus(mandate != null ? mandate.getStatus() : null)
                .mandateMaxAmount(mandate != null ? mandate.getMaxAmount() : null)
                .currency(currency)
                .hasActiveMandate(liveMandate)
                .packageSessionIds(packageSessionIds)
                .planPrice(plan.getPaymentPlan() != null ? plan.getPaymentPlan().getActualPrice() : null)
                .vendorId(plan.getEnrollInvite() != null ? plan.getEnrollInvite().getVendorId() : null)
                .canRenewManually(canRenewManually)
                .autopayAvailable(isAutopayAvailable(plan))
                .build();
    }

    /** Whether the plan's invite has autopay configured (AUTOPAY_SETTING.ENABLED). */
    private boolean isAutopayAvailable(UserPlan plan) {
        if (plan.getEnrollInvite() == null || !StringUtils.hasText(plan.getEnrollInvite().getSettingJson())) {
            return false;
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readTree(plan.getEnrollInvite().getSettingJson())
                    .path("setting").path("AUTOPAY_SETTING").path("ENABLED").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Start a MANUAL RENEWAL payment for the learner's existing plan ("pay to
     * continue"). Amount/vendor are SERVER-derived from the plan (never trusted
     * from the client). With {@code withAutopay} (allowed only when the invite
     * has AUTOPAY_SETTING.ENABLED) the checkout opens in mandate mode: the same
     * approval charges the price AND registers a fresh UPI Autopay/e-mandate,
     * so future cycles auto-deduct again.
     */
    public vacademy.io.common.payment.dto.PaymentResponseDTO initiateRenewalPayment(
            vacademy.io.common.auth.model.CustomUserDetails userDetails,
            String instituteId, String userPlanId, boolean withAutopay) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("Subscription not found: " + userPlanId));
        if (!userDetails.getUserId().equals(plan.getUserId())) {
            throw new VacademyException("Subscription does not belong to the current user");
        }
        if (plan.getEnrollInvite() == null) {
            throw new VacademyException("Subscription has no enrollment invite — cannot build payment");
        }
        if (plan.getPaymentPlan() == null || plan.getPaymentPlan().getActualPrice() <= 0) {
            throw new VacademyException("Subscription has no payable plan price");
        }
        if (withAutopay && !isAutopayAvailable(plan)) {
            throw new VacademyException("Autopay is not enabled for this membership's invite");
        }

        var invite = plan.getEnrollInvite();
        List<vacademy.io.common.auth.dto.UserDTO> users =
                authService.getUsersFromAuthServiceByUserIds(List.of(plan.getUserId()));
        if (users.isEmpty()) {
            throw new VacademyException("Learner account not found");
        }
        var user = users.get(0);

        var request = new vacademy.io.common.payment.dto.PaymentInitiationRequestDTO();
        request.setAmount(plan.getPaymentPlan().getActualPrice());
        request.setCurrency(StringUtils.hasText(invite.getCurrency()) ? invite.getCurrency() : "INR");
        request.setDescription("Membership renewal — "
                + (plan.getPaymentPlan().getName() != null ? plan.getPaymentPlan().getName() : "subscription"));
        request.setInstituteId(instituteId);
        request.setEmail(user.getEmail());
        request.setVendor(invite.getVendor());
        request.setVendorId(invite.getVendorId());
        request.setPaymentType(vacademy.io.common.payment.enums.PaymentType.RENEWAL);
        var razorpayRequest = new vacademy.io.common.payment.dto.RazorpayRequestDTO();
        razorpayRequest.setContact(user.getMobileNumber());
        razorpayRequest.setEmail(user.getEmail());
        request.setRazorpayRequest(razorpayRequest);

        if (withAutopay) {
            // Mandate-mode checkout: charge + register a fresh recurring mandate.
            return paymentService.handleMandatePayment(user, instituteId, invite, plan, request);
        }
        return paymentService.handleUserPlanPayment(request, instituteId, userDetails, userPlanId);
    }

    private String resolveVendor(UserPlan plan) {
        if (plan.getEnrollInvite() != null && StringUtils.hasText(plan.getEnrollInvite().getVendor())) {
            return plan.getEnrollInvite().getVendor();
        }
        if (StringUtils.hasText(plan.getJsonPaymentDetails())) {
            try {
                PaymentInitiationRequestDTO req = JsonUtil.fromJson(
                        plan.getJsonPaymentDetails(), PaymentInitiationRequestDTO.class);
                if (req != null && StringUtils.hasText(req.getVendor())) {
                    return req.getVendor().toUpperCase();
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }
}
