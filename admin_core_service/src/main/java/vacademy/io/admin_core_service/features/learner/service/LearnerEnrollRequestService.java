package vacademy.io.admin_core_service.features.learner.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationFactory;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationStrategy;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;

import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class LearnerEnrollRequestService {

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private PaymentOptionOperationFactory paymentOptionOperationFactory;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private PaymentPlanService paymentPlanService;

    @Autowired
    private AuthService authService;


    @Autowired
    private LearnerCouponService learnerCouponService;

    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Transactional
    public LearnerEnrollResponseDTO recordLearnerRequest(LearnerEnrollRequestDTO learnerEnrollRequestDTO) {
        LearnerPackageSessionsEnrollDTO enrollDTO = learnerEnrollRequestDTO.getLearnerPackageSessionEnroll();
        if (!StringUtils.hasText(learnerEnrollRequestDTO.getUser().getId())) {
            UserDTO user = authService.createUserFromAuthService(learnerEnrollRequestDTO.getUser(), learnerEnrollRequestDTO.getInstituteId(),true);
            learnerEnrollRequestDTO.setUser(user);
            // Generate coupon code for new learner enrollment
            learnerCouponService.generateCouponCodeForLearner(user.getId());
        }
        EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = getValidatedPaymentOption(enrollDTO.getPaymentOptionId());
        PaymentPlan paymentPlan = getOptionalPaymentPlan(enrollDTO.getPlanId());
        // Use new dynamic notification system
        sendDynamicNotificationForEnrollment(
                learnerEnrollRequestDTO.getInstituteId(),
                learnerEnrollRequestDTO.getUser(),
                paymentOption,
                enrollInvite,
                enrollDTO.getPackageSessionIds().get(0) // Get first package session ID
        );
        
        // Send separate referral invitation email
        sendReferralInvitationEmail(
                learnerEnrollRequestDTO.getInstituteId(),
                learnerEnrollRequestDTO.getUser(),
                enrollInvite
        );
        UserPlan userPlan = createUserPlan(
            learnerEnrollRequestDTO.getUser().getId(),
            enrollDTO,
            enrollInvite,
            paymentOption,
            paymentPlan
        );
        return enrollLearnerToBatch(
            learnerEnrollRequestDTO,
            enrollDTO,
            enrollInvite,
            paymentOption,
            userPlan
        );
    }
    private void sendDynamicNotificationForEnrollment(
            String instituteId, 
            UserDTO user, 
            PaymentOption paymentOption, 
            EnrollInvite enrollInvite,
            String packageSessionId) {
        
        try {
            dynamicNotificationService.sendDynamicNotification(
                    NotificationEventType.LEARNER_ENROLL,
                    packageSessionId,
                    instituteId,
                    user,
                    paymentOption,
                    enrollInvite
            );
        } catch (Exception e) {
            log.error("Error sending dynamic notification for enrollment", e);
        }
    }

    private void sendReferralInvitationEmail(
            String instituteId, 
            UserDTO user, 
            EnrollInvite enrollInvite) {
        
        try {
            dynamicNotificationService.sendReferralInvitationNotification(
                    instituteId,
                    user,
                    enrollInvite
            );
        } catch (Exception e) {
            log.error("Error sending referral invitation email", e);
        }
    }

    private EnrollInvite getValidatedEnrollInvite(String enrollInviteId) {
        return Optional.ofNullable(enrollInviteId)
            .map(enrollInviteService::findById)
            .orElseThrow(() -> new IllegalArgumentException("Enroll Invite ID is required."));
    }

    private PaymentOption getValidatedPaymentOption(String paymentOptionId) {
        return Optional.ofNullable(paymentOptionId)
            .map(paymentOptionService::findById)
            .orElseThrow(() -> new IllegalArgumentException("Payment Option ID is required."));
    }

    private PaymentPlan getOptionalPaymentPlan(String planId) {
        return Optional.ofNullable(planId)
            .flatMap(paymentPlanService::findById)
            .orElse(null); // It's okay if there's no plan
    }

    private UserPlan createUserPlan(
        String userId,
        LearnerPackageSessionsEnrollDTO enrollDTO,
        EnrollInvite enrollInvite,
        PaymentOption paymentOption,
        PaymentPlan paymentPlan
    ) {
        String userPlanStatus = null;
        if (paymentOption.getType().equals(PaymentOptionType.SUBSCRIPTION.name()) || paymentOption.getType().equals(PaymentOptionType.ONE_TIME.name())) {
            userPlanStatus = UserPlanStatusEnum.PENDING_FOR_PAYMENT.name();
        }else {
            userPlanStatus = UserPlanStatusEnum.ACTIVE.name();
        }

        return userPlanService.createUserPlan(
            userId,
            paymentPlan,
            null, // coupon can be handled later if needed
            enrollInvite,
            paymentOption,
            enrollDTO.getPaymentInitiationRequest(),
            userPlanStatus
        );
    }

    private LearnerEnrollResponseDTO enrollLearnerToBatch(
        LearnerEnrollRequestDTO learnerEnrollRequestDTO,
        LearnerPackageSessionsEnrollDTO enrollDTO,
        EnrollInvite enrollInvite,
        PaymentOption paymentOption,
        UserPlan userPlan
    ) {
        PaymentOptionOperationStrategy strategy = paymentOptionOperationFactory
            .getStrategy(PaymentOptionType.fromString(paymentOption.getType()));

        return strategy.enrollLearnerToBatch(
            learnerEnrollRequestDTO.getUser(),
            enrollDTO,
            learnerEnrollRequestDTO.getInstituteId(),
            enrollInvite,
            paymentOption,
            userPlan,
            Map.of() // optional extra data
        );
    }

}
