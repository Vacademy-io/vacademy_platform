package vacademy.io.admin_core_service.features.learner.service;

import com.stripe.service.PlanService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationFactory;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationStrategy;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentPlanService;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerSignupDTO;

import java.util.Map;
import java.util.Optional;

@Service
public class LearnerSignupService {

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

    @Transactional
    public LearnerEnrollResponseDTO signupLearner(LearnerSignupDTO learnerSignupDTO) {
        LearnerPackageSessionsEnrollDTO enrollDTO = learnerSignupDTO.getLearnerPackageSessionsEnrollDTO();

        EnrollInvite enrollInvite = getValidatedEnrollInvite(enrollDTO.getEnrollInviteId());
        PaymentOption paymentOption = getValidatedPaymentOption(enrollDTO.getPaymentOptionId());
        PaymentPlan paymentPlan = getOptionalPaymentPlan(enrollDTO.getPlanId());

        UserPlan userPlan = createUserPlan(
                learnerSignupDTO.getUser().getId(),
                enrollDTO,
                enrollInvite,
                paymentOption,
                paymentPlan
        );

        return enrollLearnerToBatch(
                learnerSignupDTO,
                enrollDTO,
                enrollInvite,
                paymentOption,
                userPlan
        );
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
        String userPlanStatus = paymentOption.isRequireApproval()
                ? UserPlanStatusEnum.PENDING_FOR_APPROVAL.name()
                : UserPlanStatusEnum.ACTIVE.name();

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
            LearnerSignupDTO learnerSignupDTO,
            LearnerPackageSessionsEnrollDTO enrollDTO,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            UserPlan userPlan
    ) {
        PaymentOptionOperationStrategy strategy = paymentOptionOperationFactory
                .getStrategy(PaymentOptionType.fromString(paymentOption.getType()));

        return strategy.enrollLearnerToBatch(
                learnerSignupDTO.getUser(),
                enrollDTO,
                learnerSignupDTO.getInstituteId(),
                enrollInvite,
                paymentOption,
                userPlan,
                Map.of() // optional extra data
        );
    }
}
