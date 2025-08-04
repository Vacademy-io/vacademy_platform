package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class FreePaymentOptionOperation implements PaymentOptionOperationStrategy{
    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

    @Override
    public LearnerEnrollResponseDTO enrollLearnerToBatch(UserDTO userDTO,
                                                         LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
                                                         String instituteId,
                                                         EnrollInvite enrollInvite,
                                                         PaymentOption paymentOption,
                                                         UserPlan userPlan,
                                                         Map<String, Object> extraData) {
        List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
        if (paymentOption.isRequireApproval()){
            String status = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
            // to do: find all invited package sessions and pass destination package session id etc
        }else{
            String status = LearnerStatusEnum.ACTIVE.name();
            Integer accessDays = enrollInvite.getLearnerAccessDays();
            List<String>packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();
            for (String packageSessionId : packageSessionIds) {
                InstituteStudentDetails instituteStudentDetail = new InstituteStudentDetails(instituteId, packageSessionId, null, status, new Date(), null, (accessDays != null ? accessDays.toString() : null),null);
                instituteStudentDetails.add(instituteStudentDetail);
            }
        }
        UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(userDTO, instituteId, instituteStudentDetails,learnerPackageSessionsEnrollDTO.getCustomFieldValues(), extraData);
        LearnerEnrollResponseDTO learnerEnrollResponseDTO = new LearnerEnrollResponseDTO();
        learnerEnrollResponseDTO.setUser(user);
        return learnerEnrollResponseDTO;
    }
}
