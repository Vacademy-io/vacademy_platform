package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
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

@Slf4j
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

    @Autowired
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Override
    public LearnerEnrollResponseDTO enrollLearnerToBatch(UserDTO userDTO,
            LearnerPackageSessionsEnrollDTO learnerPackageSessionsEnrollDTO,
            String instituteId,
            EnrollInvite enrollInvite,
            PaymentOption paymentOption,
            UserPlan userPlan,
            Map<String, Object> extraData, LearnerExtraDetails learnerExtraDetails) {
        log.info("Processing SUBSCRIPTION payment enrollment for user: {}", userDTO.getEmail());

        // Step 1: Create ONLY_DETAILS_FILLED entries first for tracking
        List<String> packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();
        for (String actualPackageSessionId : packageSessionIds) {
            PackageSession invitedPackageSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(actualPackageSessionId);

            PackageSession actualPackageSession = packageSessionRepository.findById(actualPackageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found: " + actualPackageSessionId));

            // Mark previous ONLY_DETAILS_FILLED and PAYMENT_FAILED entries as DELETED
            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    userDTO.getId(),
                    invitedPackageSession.getId(),
                    actualPackageSessionId,
                    instituteId);

            // Create ONLY_DETAILS_FILLED entry
            learnerEnrollmentEntryService.createOnlyDetailsFilledEntry(
                    userDTO.getId(),
                    invitedPackageSession,
                    actualPackageSession,
                    instituteId,
                    userPlan.getId());

            log.info("Created ONLY_DETAILS_FILLED entry for SUBSCRIPTION user {} in package session {}",
                    userDTO.getId(), actualPackageSessionId);
        }

        // Use startDate from DTO if provided, otherwise default to current date
        Date enrollmentDate = learnerPackageSessionsEnrollDTO.getStartDate() != null
                ? learnerPackageSessionsEnrollDTO.getStartDate()
                : new Date();

        String learnerSessionStatus = null;
        if (extraData.containsKey("ENROLLMENT_STATUS")) {
            learnerSessionStatus = (String) extraData.get("ENROLLMENT_STATUS");
            log.info("Using subscription enrollment status override: {}", learnerSessionStatus);
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
                userPlan,
                enrollmentDate);

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
                    log.info("Overriding subscription payment amount to {} from extraData", amount);
                    learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(amount);
                }
            } else {
                log.info("Setting subscription payment amount to {} from plan {}", paymentPlan.getActualPrice(),
                        paymentPlan.getId());
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setAmount(paymentPlan.getActualPrice());
            }

            if (extraData.containsKey("PARENT_PAYMENT_LOG_ID")) {
                String parentLogId = (String) extraData.get("PARENT_PAYMENT_LOG_ID");
                log.info("Linking subscription to parent payment log ID: {}", parentLogId);
                learnerPackageSessionsEnrollDTO.getPaymentInitiationRequest().setOrderId(parentLogId);
            }
        }
        // Process referral request if present
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
            PaymentResponseDTO paymentResponseDTO;
            if (extraData.containsKey("SKIP_PAYMENT_INITIATION")
                    && Boolean.TRUE.equals(extraData.get("SKIP_PAYMENT_INITIATION"))) {
                paymentResponseDTO = paymentService.handlePaymentWithoutGateway(
                        user,
                        learnerPackageSessionsEnrollDTO,
                        instituteId,
                        enrollInvite,
                        userPlan);
            } else {
                paymentResponseDTO = paymentService.handlePayment(
                        user,
                        learnerPackageSessionsEnrollDTO,
                        instituteId,
                        enrollInvite,
                        userPlan);
            }
            learnerEnrollResponseDTO.setPaymentResponse(paymentResponseDTO);
        } else {
            throw new VacademyException("PaymentInitiationRequest is null");
        }

        return learnerEnrollResponseDTO;
    }

    private List<InstituteStudentDetails> buildInstituteStudentDetails(String instituteId,
            List<String> packageSessionIds,
            Integer accessDays, String learnerSessionStatus, UserPlan userPlan, Date enrollmentDate) {
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
                    enrollmentDate,
                    null,
                    accessDays != null ? accessDays.toString() : null,
                    packageSessionId,
                    userPlan.getId(), null, null);
            detailsList.add(detail);
        }
        return detailsList;
    }

}
