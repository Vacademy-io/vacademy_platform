package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.service.EnrollInviteService;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentOptionService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.*;


@Service
public class DonationPaymentOptionOperation implements PaymentOptionOperationStrategy {

    @Autowired
    private PaymentOptionService paymentOptionService;

    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private PackageSessionService packageSessionService;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private PaymentService paymentService;

    @Override
    public LearnerEnrollResponseDTO enrollLearnerToBatch(UserDTO userDTO,
                                                         LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
                                                         String instituteId,
                                                         EnrollInvite enrollInvite,
                                                         PaymentOption paymentOption,
                                                         Map<String, Object> extraData) {
        List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
        if (paymentOption.isRequireApproval()){
            String status = LearnerStatusEnum.INVITED.name();
            // to do: find all invited package sessions and pass destination package session id etc
        }else{
            String status = LearnerStatusEnum.ACTIVE.name();
            Integer accessDays = enrollInvite.getLearnerAccessDays();
            List<String>packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();
            for (String packageSessionId : packageSessionIds) {
                InstituteStudentDetails instituteStudentDetail = new InstituteStudentDetails(instituteId, packageSessionId, null, status, new Date(), null, (accessDays != null ? accessDays.toString() : null));
                instituteStudentDetails.add(instituteStudentDetail);
            }
        }
        UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(userDTO, instituteId, instituteStudentDetails, extraData);
        LearnerEnrollResponseDTO learnerEnrollResponseDTO = new LearnerEnrollResponseDTO();
        if (learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest() != null){
           PaymentResponseDTO paymentResponseDTO = paymentService.makePayment(enrollInvite.getVendor(), instituteId, learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest());
           learnerEnrollResponseDTO.setPaymentResponseDTO(paymentResponseDTO);
        }
        learnerEnrollResponseDTO.setUser(user);
        return learnerEnrollResponseDTO;
    }
}
