package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
public class OneTimePaymentOptionOperation implements PaymentOptionOperationStrategy {
    private static final Logger log = LoggerFactory.getLogger(OneTimePaymentOptionOperation.class);

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
        log.info("Processing ONE_TIME payment enrollment for user: {}", userDTO.getEmail());

        // Step 1: ONLY_DETAILS_FILLED entries are now managed by the capture-lead step.
        // We do not create them here to avoid duplication or incorrect timing.
        // Payment success/failure handlers will clean them up.

        String learnerSessionStatus = null;
        if (extraData.containsKey("ENROLLMENT_STATUS")) {
            learnerSessionStatus = (String) extraData.get("ENROLLMENT_STATUS");
            log.info("Using enrollment status override: {}", learnerSessionStatus);
        } else if (paymentOption.isRequireApproval()) {
            learnerSessionStatus = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
        } else {
            learnerSessionStatus = LearnerStatusEnum.INVITED.name();
        }
        PaymentPlan paymentPlan = userPlan.getPaymentPlan();
        if (Objects.isNull(paymentPlan)) {
            throw new VacademyException("Payment plan is null");
        }

        List<InstituteStudentDetails> instituteStudentDetails = buildInstituteStudentDetails(
                instituteId,
                learnerPackageSessionsEnrollDTO.getPackageSessionIds(),
                paymentPlan.getValidityInDays(),
                learnerSessionStatus,
                userPlan);

        // Create or update user
        UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(
                userDTO,
                instituteId,
                instituteStudentDetails,
                learnerPackageSessionsEnrollDTO.getCustomFieldValues(),
                extraData, learnerExtraDetails, enrollInvite, userPlan);

        if (learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest() != null) {
            if (extraData.containsKey("OVERRIDE_TOTAL_AMOUNT")) {
                Object amountObj = extraData.get("OVERRIDE_TOTAL_AMOUNT");
                if (amountObj instanceof Number) {
                    Double amount = ((Number) amountObj).doubleValue();
                    log.info("Overriding payment amount to {} from extraData", amount);
                    learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(amount);
                }
            } else {
                log.info("Setting payment amount to {} from plan {}", paymentPlan.getActualPrice(),
                        paymentPlan.getId());
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(paymentPlan.getActualPrice());
            }

            if (extraData.containsKey("PARENT_PAYMENT_LOG_ID")) {
                String parentLogId = (String) extraData.get("PARENT_PAYMENT_LOG_ID");
                log.info("Linking to parent payment log ID: {}", parentLogId);
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setOrderId(parentLogId);
            }
        }
        // Process referral request if present
        List<PaymentLogLineItemDTO> referralLineItems = new ArrayList<>();
        if (learnerPackageSessionsEnrollDTO.getReferRequest() != null) {
            referralBenefitOrchestrator.processAllBenefits(
                    learnerPackageSessionsEnrollDTO,
                    paymentOption,
                    userPlan,
                    user,
                    instituteId);
        }

        // Handle payment
        LearnerEnrollResponseDTO learnerEnrollResponseDTO = new LearnerEnrollResponseDTO();
        learnerEnrollResponseDTO.setUser(user);

        if (learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest() != null) {
            PaymentInitiationRequestDTO paymentInitiationRequestDTO = learnerPackageSessionsEnrollDTO
                    .getPaymentInitiationRequest();

            if (extraData.containsKey("SKIP_PAYMENT_INITIATION")
                    && Boolean.TRUE.equals(extraData.get("SKIP_PAYMENT_INITIATION"))) {
                log.info("Skipping payment initiation for user: {}", user.getId());
                PaymentResponseDTO paymentResponseDTO = paymentService.handlePaymentWithoutGateway(
                        user,
                        learnerPackageSessionsEnrollDTO,
                        instituteId,
                        enrollInvite,
                        userPlan);
                learnerEnrollResponseDTO.setPaymentResponse(paymentResponseDTO);
            } else {
                log.info("Initiating payment through PaymentService for user: {}", user.getId());
                PaymentResponseDTO paymentResponseDTO = paymentService.handlePayment(
                        user,
                        learnerPackageSessionsEnrollDTO,
                        instituteId,
                        enrollInvite,
                        userPlan);
                learnerEnrollResponseDTO.setPaymentResponse(paymentResponseDTO);
            }
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
                    userPlan.getId(), null, null);
            detailsList.add(detail);
        }
        return detailsList;
    }
}
