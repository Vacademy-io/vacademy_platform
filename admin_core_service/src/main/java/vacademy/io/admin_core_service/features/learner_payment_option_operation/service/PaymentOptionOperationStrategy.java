package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

public interface PaymentOptionOperationStrategy {
     LearnerEnrollResponseDTO enrollLearnerToBatch(UserDTO userDTO, LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO, String instituteId, EnrollInvite enrollInvite, PaymentOption paymentOption, UserPlan userPlan, Map<String, Object> gatewaySpecificRequest);
}
