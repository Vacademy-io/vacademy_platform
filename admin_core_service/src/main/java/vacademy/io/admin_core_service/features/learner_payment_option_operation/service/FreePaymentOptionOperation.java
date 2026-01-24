package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.handler.ReferralBenefitOrchestrator;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

@Service
public class FreePaymentOptionOperation implements PaymentOptionOperationStrategy {
    private static final Logger log = LoggerFactory.getLogger(FreePaymentOptionOperation.class);

    @Autowired
    private LearnerBatchEnrollService learnerBatchEnrollService;

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
        log.info("Processing FREE enrollment for user: {}", userDTO.getEmail());

        // Use startDate from DTO if provided, otherwise default to current date
        Date enrollmentDate = learnerPackageSessionsEnrollDTO.getStartDate() != null
                ? learnerPackageSessionsEnrollDTO.getStartDate()
                : new Date();

        List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
        List<String> packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();

        // Step 1: For each package session, create ABANDONED_CART entry first
        // and mark previous entries as DELETED
        for (String actualPackageSessionId : packageSessionIds) {
            // Find the INVITED package session for this actual package session
            PackageSession invitedPackageSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(actualPackageSessionId);

            PackageSession actualPackageSession = packageSessionRepository.findById(actualPackageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found: " + actualPackageSessionId));

            // Mark previous ABANDONED_CART and PAYMENT_FAILED entries as DELETED
            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    userDTO.getId(),
                    invitedPackageSession.getId(),
                    actualPackageSessionId,
                    instituteId);

            // Create ABANDONED_CART entry
            learnerEnrollmentEntryService.createOnlyDetailsFilledEntry(
                    userDTO.getId(),
                    invitedPackageSession,
                    actualPackageSession,
                    instituteId,
                    userPlan.getId());

            log.info("Created ABANDONED_CART entry for user {} in package session {}",
                    userDTO.getId(), actualPackageSessionId);
        }

        // Step 2: Check if workflow is configured for the destination package session
        // If workflow exists, return early - only ABANDONED_CART entry should exist
        boolean hasWorkflow = false;
        for (String packageSessionId : packageSessionIds) {
            PackageSession packageSession = packageSessionRepository.findById(packageSessionId).orElse(null);
            if (packageSession != null && learnerEnrollmentEntryService.hasWorkflowConfiguration(packageSession)) {
                hasWorkflow = true;
                log.info("Workflow configuration found for package session: {}. Returning with only ABANDONED_CART entry.",
                        packageSessionId);
                break;
            }
        }

        // If workflow exists, return early - workflow will handle the rest
        if (hasWorkflow) {
            log.info("Workflow will handle enrollment for user: {}. Only ABANDONED_CART entry created.",
                    userDTO.getEmail());
            LearnerEnrollResponseDTO response = new LearnerEnrollResponseDTO();
            response.setUser(userDTO);
            return response;
        }

        // Step 3: No workflow - proceed with current enrollment flow (create ACTIVE entry)
        if (paymentOption.isRequireApproval()) {
            String status = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
            for (String packageSessionId : packageSessionIds) {
                Optional<PackageSession> invitedPackageSession = packageSessionRepository
                        .findInvitedPackageSessionForPackage(
                                packageSessionId,
                                "INVITED",
                                "INVITED",
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
                        status,
                        enrollmentDate,
                        null,
                        enrollInvite.getLearnerAccessDays() != null ? enrollInvite.getLearnerAccessDays().toString()
                                : null,
                        packageSessionId,
                        userPlan.getId(), null, null);
                instituteStudentDetails.add(detail);
            }
        } else {
            String status = LearnerStatusEnum.ACTIVE.name();
            Integer accessDays = enrollInvite.getLearnerAccessDays();
            for (String packageSessionId : packageSessionIds) {
                InstituteStudentDetails instituteStudentDetail = new InstituteStudentDetails(instituteId,
                        packageSessionId, null, status, enrollmentDate, null,
                        (accessDays != null ? accessDays.toString() : null), null, userPlan.getId(), null, null);
                instituteStudentDetails.add(instituteStudentDetail);
            }
        }

        UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(userDTO, instituteId,
                instituteStudentDetails, learnerPackageSessionsEnrollDTO.getCustomFieldValues(), extraData,
                learnerExtraDetails, enrollInvite, userPlan);

        // Step 4: Mark the ABANDONED_CART entries as DELETED since enrollment is complete
        for (String actualPackageSessionId : packageSessionIds) {
            PackageSession invitedPackageSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(actualPackageSessionId);

            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    user.getId(),
                    invitedPackageSession.getId(),
                    actualPackageSessionId,
                    instituteId);
        }

        // Process referral request if present - for free payments, benefits are activated immediately
        if (learnerPackageSessionsEnrollDTO.getReferRequest() != null) {
            referralBenefitOrchestrator.processAllBenefits(
                    learnerPackageSessionsEnrollDTO,
                    paymentOption,
                    userPlan,
                    user,
                    instituteId);
        }

        LearnerEnrollResponseDTO learnerEnrollResponseDTO = new LearnerEnrollResponseDTO();
        learnerEnrollResponseDTO.setUser(user);
        return learnerEnrollResponseDTO;
    }
}
