package vacademy.io.admin_core_service.features.learner_payment_option_operation.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteStudentDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
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

        @Autowired
        private StudentRegistrationManager studentRegistrationManager;

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

                List<String> packageSessionIds = learnerPackageSessionsEnrollDTO.getPackageSessionIds();

                // Step 1: Check if workflow is configured for the destination package session
                boolean hasWorkflow = false;
                PackageSession workflowPackageSession = null;
                for (String packageSessionId : packageSessionIds) {
                        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                                .orElse(null);
                        if (packageSession != null
                                && learnerEnrollmentEntryService.hasWorkflowConfiguration(packageSession)) {
                                hasWorkflow = true;
                                workflowPackageSession = packageSession;
                                log.info("Workflow configuration found for package session: {}",
                                        packageSessionId);
                                break;
                        }
                }

                // Step 2: For workflow enrollments, check if ACTIVE ABANDONED_CART already exists
                if (hasWorkflow) {
                        // First, ensure user exists in auth service
                        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(userDTO, instituteId, false);
                        
                        // Check for existing ACTIVE ABANDONED_CART entry
                        List<StudentSessionInstituteGroupMapping> existingEntries = 
                                learnerEnrollmentEntryService.findExistingAbandonedCartEntries(
                                        createdUser.getId(),
                                        packageSessionIds,
                                        instituteId);

                        if (!existingEntries.isEmpty()) {
                                // ABANDONED_CART already exists - just resend WhatsApp workflow
                                log.info("Found existing ABANDONED_CART entry for user: {}. Resending workflow notification.", 
                                        createdUser.getEmail());
                                
                                StudentSessionInstituteGroupMapping existingEntry = existingEntries.get(0);
                                String invitedPackageSessionId = existingEntry.getPackageSession().getId();
                                
                                // Trigger workflow to resend WhatsApp
                                studentRegistrationManager.triggerEnrollmentWorkflow(
                                        instituteId, 
                                        createdUser, 
                                        invitedPackageSessionId, 
                                        null);
                                
                                log.info("Workflow re-triggered for existing ABANDONED_CART. User: {}, PackageSession: {}", 
                                        createdUser.getEmail(), invitedPackageSessionId);
                                
                                LearnerEnrollResponseDTO response = new LearnerEnrollResponseDTO();
                                response.setUser(createdUser);
                                return response;
                        }
                        
                        // No existing entry - fall through to create new one
                        log.info("No existing ABANDONED_CART entry found. Creating new entry for user: {}", 
                                createdUser.getEmail());
                }

                // Step 3: Build enrollment details (for new enrollments)
                List<InstituteStudentDetails> instituteStudentDetails = new ArrayList<>();
                String status;
                String type = null; // null = default PACKAGE_SESSION type
                if (hasWorkflow) {
                        // Workflow exists - set status ACTIVE and type ABANDONED_CART
                        status = LearnerSessionStatusEnum.ACTIVE.name();
                        type = LearnerSessionTypeEnum.ABANDONED_CART.name();
                } else if (paymentOption.isRequireApproval()) {
                        status = LearnerStatusEnum.PENDING_FOR_APPROVAL.name();
                } else {
                        status = LearnerStatusEnum.ACTIVE.name();
                }

                Integer accessDays = enrollInvite.getLearnerAccessDays();

                for (String packageSessionId : packageSessionIds) {
                        if (hasWorkflow || paymentOption.isRequireApproval()) {
                                // Use INVITED package session with destination
                                Optional<PackageSession> invitedPackageSession = packageSessionRepository
                                        .findInvitedPackageSessionForPackage(
                                                packageSessionId,
                                                "INVITED",
                                                "INVITED",
                                                List.of(PackageSessionStatusEnum.INVITED.name()),
                                                List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                                List.of(PackageStatusEnum.ACTIVE.name()));

                                if (invitedPackageSession.isEmpty()) {
                                        throw new VacademyException(
                                                "Learner cannot be enrolled as there is no invited package session");
                                }

                                InstituteStudentDetails detail = new InstituteStudentDetails(
                                        instituteId,
                                        invitedPackageSession.get().getId(),
                                        null,
                                        status,
                                        enrollmentDate,
                                        null,
                                        accessDays != null ? accessDays.toString() : null,
                                        packageSessionId, // destination package session
                                        userPlan.getId(), null, null, type);
                                instituteStudentDetails.add(detail);
                        } else {
                                // Direct enrollment to actual package session
                                InstituteStudentDetails instituteStudentDetail = new InstituteStudentDetails(
                                        instituteId,
                                        packageSessionId, null, status, enrollmentDate, null,
                                        accessDays != null ? accessDays.toString() : null,
                                        null, // no destination needed for direct enrollment
                                        userPlan.getId(), null, null, type);
                                instituteStudentDetails.add(instituteStudentDetail);
                        }
                }

                UserDTO user = learnerBatchEnrollService.checkAndCreateStudentAndAddToBatch(userDTO, instituteId,
                        instituteStudentDetails, learnerPackageSessionsEnrollDTO.getCustomFieldValues(),
                        extraData,
                        learnerExtraDetails, enrollInvite, userPlan);

                // Process referral request if present - for free payments, benefits are
                // activated immediately
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
