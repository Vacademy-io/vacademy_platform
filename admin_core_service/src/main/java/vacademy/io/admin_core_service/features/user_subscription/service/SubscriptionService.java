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
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

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

    private static final List<String> VISIBLE_STATUSES = List.of(
            UserPlanStatusEnum.ACTIVE.name(),
            UserPlanStatusEnum.CANCELED.name(),
            UserPlanStatusEnum.PAYMENT_FAILED.name());

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
                .currency(mandate != null ? mandate.getCurrency() : null)
                .hasActiveMandate(liveMandate)
                .packageSessionIds(packageSessionIds)
                .build();
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
