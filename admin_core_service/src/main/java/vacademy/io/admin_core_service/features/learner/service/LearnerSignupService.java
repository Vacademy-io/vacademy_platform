package vacademy.io.admin_core_service.features.learner.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationFactory;
import vacademy.io.admin_core_service.features.learner_payment_option_operation.service.PaymentOptionOperationStrategy;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerSignupDTO;

import java.util.Map;

@Service
public class LearnerSignupService {

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private PaymentOptionOperationFactory paymentOptionOperationFactory;

    @Transactional
    public LearnerEnrollResponseDTO signupLearner(LearnerSignupDTO learnerSignupDTO){
        EnrollInvite enrollInvite = enrollInviteService.findById(learnerSignupDTO.getLearnerPackageSessionsEnrollDTO().getEnrollInviteId());
        PaymentOption paymentOption = paymentOptionService.findById(learnerSignupDTO.getLearnerPackageSessionsEnrollDTO().getPaymentOptionId());
        PaymentOptionOperationStrategy paymentOptionOperationStrategy = paymentOptionOperationFactory.getStrategy(PaymentOptionType.fromString(paymentOption.getType()));
        return paymentOptionOperationStrategy.enrollLearnerToBatch(learnerSignupDTO.getUser(),
                learnerSignupDTO.getLearnerPackageSessionsEnrollDTO(),
                learnerSignupDTO.getInstituteId(),
                enrollInvite,
                paymentOption,
                Map.of());
    }
}
