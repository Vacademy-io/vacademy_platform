package vacademy.io.admin_core_service.features.user_subscription.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.PackageSessionEnrollInviteToPaymentOptionService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.user_subscription.entity.AppliedCouponDiscount;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;

import java.util.List;

@Service
public class UserPlanService {

    private static final Logger logger = LoggerFactory.getLogger(UserPlanService.class);

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private PackageSessionEnrollInviteToPaymentOptionService packageSessionEnrollInviteToPaymentOptionService;

    @Autowired
    public LearnerBatchEnrollService learnerBatchEnrollService;

    public UserPlan createUserPlan(String userId,
                                   PaymentPlan paymentPlan,
                                   AppliedCouponDiscount appliedCouponDiscount,
                                   EnrollInvite enrollInvite,
                                   PaymentOption paymentOption,
                                   PaymentInitiationRequestDTO paymentInitiationRequestDTO,
                                   String status) {
        logger.info("Creating UserPlan for userId={}, status={}", userId, status);

        UserPlan userPlan = new UserPlan();
        userPlan.setStatus(status);
        userPlan.setUserId(userId);

        setPaymentPlan(userPlan, paymentPlan);
        setAppliedCouponDiscount(userPlan, appliedCouponDiscount);
        setEnrollInvite(userPlan, enrollInvite);
        setPaymentOption(userPlan, paymentOption);

        String paymentJson = JsonUtil.toJson(paymentInitiationRequestDTO);
        userPlan.setJsonPaymentDetails(paymentJson);

        logger.debug("Saving UserPlan with details: {}", userPlan);
        UserPlan saved = userPlanRepository.save(userPlan);
        logger.info("UserPlan created with ID={}", saved.getId());
        return saved;
    }

    private void setPaymentPlan(UserPlan userPlan, PaymentPlan plan) {
        if (plan != null) {
            userPlan.setPaymentPlan(plan);
            userPlan.setPaymentPlanId(plan.getId());
            userPlan.setPlanJson(JsonUtil.toJson(plan));
            logger.debug("Attached PaymentPlan ID={} to UserPlan", plan.getId());
        }
    }

    private void setAppliedCouponDiscount(UserPlan userPlan, AppliedCouponDiscount discount) {
        if (discount != null) {
            userPlan.setAppliedCouponDiscount(discount);
            userPlan.setAppliedCouponDiscountId(discount.getId());
            userPlan.setAppliedCouponDiscountJson(JsonUtil.toJson(discount));
            logger.debug("Attached AppliedCouponDiscount ID={} to UserPlan", discount.getId());
        }
    }

    private void setEnrollInvite(UserPlan userPlan, EnrollInvite invite) {
        if (invite != null) {
            userPlan.setEnrollInvite(invite);
            userPlan.setEnrollInviteId(invite.getId());
            logger.debug("Attached EnrollInvite ID={} to UserPlan", invite.getId());
        }
    }

    private void setPaymentOption(UserPlan userPlan, PaymentOption option) {
        if (option != null) {
            userPlan.setPaymentOption(option);
            userPlan.setPaymentOptionId(option.getId());
            userPlan.setPaymentOptionJson(JsonUtil.toJson(option));
            logger.debug("Attached PaymentOption ID={} to UserPlan", option.getId());
        }
    }

    public void applyOperationsOnFirstPayment(UserPlan userPlan) {
        logger.info("Applying operations on first payment for UserPlan ID={}", userPlan.getId());

        if (userPlan.getStatus().equalsIgnoreCase(UserPlanStatusEnum.ACTIVE.name())) {
            logger.info("UserPlan already ACTIVE. Skipping re-activation.");
            return;
        }

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();

        List<String> packageSessionIds = packageSessionEnrollInviteToPaymentOptionService.findPackageSessionsOfEnrollInvite(enrollInvite);
        logger.debug("Package session IDs resolved for EnrollInvite ID={}: {}", enrollInvite.getId(), packageSessionIds);
        learnerBatchEnrollService.shiftLearnerFromInvitedToActivePackageSessions(packageSessionIds, userPlan.getUserId(), enrollInvite.getId());
        userPlan.setStatus(UserPlanStatusEnum.ACTIVE.name());
        userPlanRepository.save(userPlan);

        logger.info("UserPlan status updated to ACTIVE and saved. ID={}", userPlan.getId());
    }
}
