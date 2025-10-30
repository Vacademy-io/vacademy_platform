package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.handler.ReferralBenefitOrchestrator;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentLogLineItemDTO;

import java.util.*;

@Service
public class SubscriptionPaymentOptionOperation implements PaymentOptionOperationStrategy {

    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private ReferralBenefitOrchestrator referralBenefitOrchestrator;

    @Autowired
    private AuthService authService;

    @Override
    public LearnerEnrollResponseDTO enrollLearnerToBatch(UserDTO userDTO,
                                                         LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
                                                         String instituteId,
                                                         EnrollInvite enrollInvite,
                                                         PaymentOption paymentOption,
                                                         UserPlan userPlan,
                                                         Map<String, Object> extraData, LearnerExtraDetails learnerExtraDetails) {
        String learnerSessionStatus = null;
        if (paymentOption.isRequireApproval()) {
            learnerSessionStatus = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
        } else {
            learnerSessionStatus = LearnerStatusEnum.INVITED.name();
        }
        List<InstituteStudentDetails> instituteStudentDetails = buildInstituteStudentDetails(
                instituteId,
                learnerPackageSessionsEnrollDTO.getPackageSessionIds(),
                userPlan.getPaymentPlan().getValidityInDays(),
                learnerSessionStatus,
                userPlan);

        // Create or update user
        UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(
                userDTO,
                instituteId,
                instituteStudentDetails,
                learnerPackageSessionsEnrollDTO.getCustomFieldValues(),
                extraData,learnerExtraDetails);

        PaymentPlan paymentPlan = userPlan.getPaymentPlan();
        if (Objects.isNull(paymentPlan)) {
            throw new VacademyException("Payment plan is null");
        }
        learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(paymentPlan.getActualPrice());
        // Process referral request if present
        if (learnerPackageSessionsEnrollDTO.getReferRequest() != null) {
            referralBenefitOrchestrator.processAllBenefits(
                    learnerPackageSessionsEnrollDTO,
                    paymentOption,
                    userPlan,
                    user,
                    instituteId
            );
        }

        // Handle payment
        LearnerEnrollResponseDTO learnerEnrollResponseDTO = new LearnerEnrollResponseDTO();
        learnerEnrollResponseDTO.setUser(user);

        if (learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest() != null) {
            PaymentInitiationRequestDTO paymentInitiationRequestDTO = learnerPackageSessionsEnrollDTO
                    .getPaymentInitiationRequest();

            PaymentResponseDTO paymentResponseDTO = paymentService.handlePayment(
                    user,
                    learnerPackageSessionsEnrollDTO,
                    instituteId,
                    enrollInvite,
                    userPlan);
            learnerEnrollResponseDTO.setPaymentResponse(paymentResponseDTO);
        } else {
            throw new VacademyException("PaymentInitiationRequest is null");
        }

        return learnerEnrollResponseDTO;
    }

    private List<InstituteStudentDetails> buildInstituteStudentDetails(String instituteId,
                                                                       List<String> packageSessionIds,
                                                                       Integer accessDays, String learnerSessionStatus, UserPlan userPlan) {
        List<InstituteStudentDetails> detailsList = new ArrayList<>();

        for (String packageSessionId : packageSessionIds) {
            Optional<PackageSession> invitedPackageSession = packageSessionRepository
                    .findInvitedPackageSessionForPackage(
                            packageSessionId,
                            "INVITED", // levelId (placeholder — ensure correct value)
                            "INVITED", // sessionId (placeholder — ensure correct value)
                            List.of(PackageSessionStatusEnum.INVITED.name()),
                            List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                            List.of(PackageStatusEnum.ACTIVE.name()));

            if (invitedPackageSession.isEmpty()) {
                throw new VacademyException("Learner cannot be enrolled as there is no invited package session");
            }

            InstituteStudentDetails detail = new InstituteStudentDetails(
                    instituteId,
                    invitedPackageSession.get().getId(),
                    null,
                    learnerSessionStatus,
                    new Date(),
                    null,
                    accessDays != null ? accessDays.toString() : null,
                    packageSessionId,
                    userPlan.getId());
            detailsList.add(detail);
        }
        return detailsList;
    }

}
