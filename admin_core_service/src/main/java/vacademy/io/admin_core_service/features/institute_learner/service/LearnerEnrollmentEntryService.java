package vacademy.io.admin_core_service.features.institute_learner.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionTypeEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.policy.EnrollmentPolicyJsonDTOs;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

/**
 * Service to handle learner enrollment entry creation with ONLY_DETAILS_FILLED
 * type tracking.
 * This creates an initial tracking entry before payment/workflow processing.
 */
@Slf4j
@Service
public class LearnerEnrollmentEntryService {

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InstituteRepository instituteRepository;

    /**
     * Finds the INVITED package session for a given actual package session.
     * Every package has an INVITED session where level_id='INVITED' and
     * session_id='INVITED'.
     *
     * @param actualPackageSessionId The actual package session ID from frontend
     * @return The INVITED package session
     * @throws VacademyException if no INVITED session found
     */
    public PackageSession findInvitedPackageSession(String actualPackageSessionId) {
        Optional<PackageSession> invitedSession = packageSessionRepository.findInvitedPackageSessionForPackage(
                actualPackageSessionId,
                "INVITED",
                "INVITED",
                List.of(PackageSessionStatusEnum.INVITED.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                List.of(PackageStatusEnum.ACTIVE.name()));

        if (invitedSession.isEmpty()) {
            log.error("No INVITED package session found for package session ID: {}", actualPackageSessionId);
            throw new VacademyException("No INVITED package session found for enrollment");
        }

        return invitedSession.get();
    }

    /**
     * Marks previous ONLY_DETAILS_FILLED and PAYMENT_FAILED entries as DELETED.
     * Called when a user re-submits the enrollment form.
     *
     * @param userId                  The user ID
     * @param invitedPackageSessionId The INVITED package session ID
     * @param actualPackageSessionId  The actual (destination) package session ID
     * @param instituteId             The institute ID
     * @return Number of entries marked as DELETED
     */
    public int markPreviousEntriesAsDeleted(String userId, String invitedPackageSessionId,
            String actualPackageSessionId, String instituteId) {
        List<String> typesToDelete = List.of(
                LearnerSessionTypeEnum.ONLY_DETAILS_FILLED.name(),
                LearnerSessionTypeEnum.PAYMENT_FAILED.name());

        int deletedCount = studentSessionRepository.markEntriesAsDeleted(
                userId,
                invitedPackageSessionId,
                actualPackageSessionId,
                instituteId,
                typesToDelete);

        log.info("Marked {} previous entries as DELETED for user: {}, destination: {}",
                deletedCount, userId, actualPackageSessionId);
        return deletedCount;
    }

    /**
     * Creates an ONLY_DETAILS_FILLED entry for initial form submission tracking.
     *
     * @param userId                The user ID
     * @param invitedPackageSession The INVITED package session
     * @param actualPackageSession  The actual (destination) package session
     * @param instituteId           The institute ID
     * @param userPlanId            The user plan ID
     * @return The created mapping
     */
    public StudentSessionInstituteGroupMapping createOnlyDetailsFilledEntry(
            String userId,
            PackageSession invitedPackageSession,
            PackageSession actualPackageSession,
            String instituteId,
            String userPlanId) {

        // Fetch institute entity
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) {
            log.warn("Institute not found for ID: {}. Entry will be created without institute.", instituteId);
        }

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(invitedPackageSession);
        mapping.setDestinationPackageSession(actualPackageSession);
        mapping.setType(LearnerSessionTypeEnum.ONLY_DETAILS_FILLED.name());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setUserPlanId(userPlanId);
        mapping.setInstitute(institute);

        StudentSessionInstituteGroupMapping saved = studentSessionRepository.save(mapping);
        log.info("Created ONLY_DETAILS_FILLED entry with ID: {} for user: {}, destination: {}, institute: {}",
                saved.getId(), userId, actualPackageSession.getId(), instituteId);

        return saved;
    }

    /**
     * Creates a PAYMENT_FAILED entry when payment fails.
     *
     * @param userId                The user ID
     * @param invitedPackageSession The INVITED package session
     * @param actualPackageSession  The actual (destination) package session
     * @param instituteId           The institute ID
     * @param userPlanId            The user plan ID
     * @return The created mapping
     */
    public StudentSessionInstituteGroupMapping createPaymentFailedEntry(
            String userId,
            PackageSession invitedPackageSession,
            PackageSession actualPackageSession,
            String instituteId,
            String userPlanId) {

        // Fetch institute entity
        Institute institute = instituteRepository.findById(instituteId).orElse(null);
        if (institute == null) {
            log.warn("Institute not found for ID: {}. Entry will be created without institute.", instituteId);
        }

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(invitedPackageSession);
        mapping.setDestinationPackageSession(actualPackageSession);
        mapping.setType(LearnerSessionTypeEnum.PAYMENT_FAILED.name());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setUserPlanId(userPlanId);
        mapping.setInstitute(institute);

        StudentSessionInstituteGroupMapping saved = studentSessionRepository.save(mapping);
        log.info("Created PAYMENT_FAILED entry with ID: {} for user: {}, destination: {}, institute: {}",
                saved.getId(), userId, actualPackageSession.getId(), instituteId);

        return saved;
    }

    /**
     * Checks if workflow is configured for the package session.
     *
     * @param packageSession The package session to check
     * @return true if workflow is enabled, false otherwise
     */
    public boolean hasWorkflowConfiguration(PackageSession packageSession) {
        try {
            String enrollmentPolicySettings = packageSession.getEnrollmentPolicySettings();
            if (!StringUtils.hasText(enrollmentPolicySettings)) {
                return false;
            }

            EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings = objectMapper.readValue(
                    enrollmentPolicySettings,
                    EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO.class);

            if (settings.getWorkflow() == null) {
                return false;
            }

            return Boolean.TRUE.equals(settings.getWorkflow().getEnabled())
                    && settings.getWorkflow().getWorkflows() != null
                    && !settings.getWorkflow().getWorkflows().isEmpty();

        } catch (Exception e) {
            log.warn("Error parsing enrollment policy settings for package session {}: {}",
                    packageSession.getId(), e.getMessage());
            return false;
        }
    }

    /**
     * Gets the workflow configuration for a package session.
     *
     * @param packageSession The package session
     * @return The workflow config DTO or null if not configured
     */
    public EnrollmentPolicyJsonDTOs.WorkflowConfigDTO getWorkflowConfiguration(PackageSession packageSession) {
        try {
            String enrollmentPolicySettings = packageSession.getEnrollmentPolicySettings();
            if (!StringUtils.hasText(enrollmentPolicySettings)) {
                return null;
            }

            EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO settings = objectMapper.readValue(
                    enrollmentPolicySettings,
                    EnrollmentPolicyJsonDTOs.EnrollmentPolicySettingsDTO.class);

            return settings.getWorkflow();

        } catch (Exception e) {
            log.warn("Error parsing enrollment policy settings for package session {}: {}",
                    packageSession.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Gets the list of workflow IDs configured for a package session.
     *
     * @param packageSession The package session
     * @return List of workflow IDs (empty if none configured)
     */
    public List<String> getWorkflowIds(PackageSession packageSession) {
        try {
            EnrollmentPolicyJsonDTOs.WorkflowConfigDTO workflowConfig = getWorkflowConfiguration(packageSession);

            if (workflowConfig == null || !Boolean.TRUE.equals(workflowConfig.getEnabled())) {
                return List.of();
            }

            if (workflowConfig.getWorkflows() == null || workflowConfig.getWorkflows().isEmpty()) {
                return List.of();
            }

            return workflowConfig.getWorkflows().stream()
                    .map(EnrollmentPolicyJsonDTOs.WorkflowItemDTO::getWorkflowId)
                    .filter(id -> id != null && !id.isBlank())
                    .toList();

        } catch (Exception e) {
            log.warn("Error getting workflow IDs for package session {}: {}",
                    packageSession.getId(), e.getMessage());
            return List.of();
        }
    }

    /**
     * Finds ONLY_DETAILS_FILLED entries for a specific user plan.
     * Used during payment webhook processing.
     *
     * @param userId      The user ID
     * @param userPlanId  The user plan ID
     * @param instituteId The institute ID
     * @return List of matching entries
     */
    public List<StudentSessionInstituteGroupMapping> findOnlyDetailsFilledEntriesForUserPlan(
            String userId, String userPlanId, String instituteId) {

        return studentSessionRepository.findAllByUserPlanIdAndStatusIn(
                userPlanId,
                List.of(LearnerSessionStatusEnum.ACTIVE.name())).stream()
                .filter(m -> LearnerSessionTypeEnum.ONLY_DETAILS_FILLED.name().equals(m.getType()))
                .filter(m -> m.getInstitute() != null && instituteId.equals(m.getInstitute().getId()))
                .toList();
    }

    /**
     * Finds ONLY_DETAILS_FILLED and PAYMENT_FAILED entries for cleanup given a list
     * of
     * destination
     * package sessions.
     * This is robust against missing userPlanId in the Only Details Filled entry.
     */
    public List<StudentSessionInstituteGroupMapping> findAbandonedCartsForCleanup(
            String userId, String instituteId, List<String> destinationPackageSessionIds) {

        return studentSessionRepository.findByUserAndDestinationsAndTypeAndStatus(
                userId,
                destinationPackageSessionIds,
                instituteId,
                List.of(LearnerSessionTypeEnum.ONLY_DETAILS_FILLED.name(),
                        LearnerSessionTypeEnum.PAYMENT_FAILED.name()),
                List.of(LearnerSessionStatusEnum.ACTIVE.name()));
    }
}
