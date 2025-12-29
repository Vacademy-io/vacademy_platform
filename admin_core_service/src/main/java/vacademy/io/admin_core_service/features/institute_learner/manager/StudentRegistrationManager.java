package vacademy.io.admin_core_service.features.institute_learner.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.ReenrollmentPolicyDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.ActiveRepurchaseBehavior;
import vacademy.io.admin_core_service.features.institute.controller.InstituteCertificateController;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.*;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.learner.service.LearnerCouponService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Component
public class StudentRegistrationManager {

    private final InstituteCertificateController instituteCertificateController;

    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    @Autowired
    private LearnerCouponService learnerCouponService;

    @Autowired
    private UserPlanService userPlanService;

    @Autowired
    private WorkflowTriggerService workflowTriggerService;

    @Autowired
    private InstituteRepository instituteRepository;

    StudentRegistrationManager(InstituteCertificateController instituteCertificateController) {
        this.instituteCertificateController = instituteCertificateController;
    }

    public InstituteStudentDTO addStudentToInstitute(CustomUserDetails user, InstituteStudentDTO instituteStudentDTO,
            BulkUploadInitRequest bulkUploadInitRequest) {
        instituteStudentDTO = this.updateAsPerConfig(instituteStudentDTO, bulkUploadInitRequest);
        Student student = checkAndCreateStudent(instituteStudentDTO);
        linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
        learnerCouponService.generateCouponCodeForLearner(student.getUserId());
        if (instituteStudentDTO.getInstituteStudentDetails().getEnrollmentStatus().equalsIgnoreCase(LearnerSessionStatusEnum.ACTIVE.name())){
            triggerEnrollmentWorkflow(instituteStudentDTO.getInstituteStudentDetails().getInstituteId(),instituteStudentDTO.getUserDetails(),instituteStudentDTO.getInstituteStudentDetails().getPackageSessionId(),null);
        }
        return instituteStudentDTO;
    }

    /**
     * Parses enrollment policy JSON string to EnrollmentPolicySettingsDTO.
     */
    private EnrollmentPolicySettingsDTO parseEnrollmentPolicy(String policyJson) {
        if (!StringUtils.hasText(policyJson)) {
            return null;
        }

        try {
            return JsonUtil.fromJson(policyJson, EnrollmentPolicySettingsDTO.class);
        } catch (Exception e) {
            log.warn("Failed to parse enrollment policy JSON: {}", e.getMessage());
            return null;
        }
    }

    public ResponseEntity<StudentDTO> addOpenStudentToInstitute(UserDTO userDTO, String instituteId) {
        InstituteStudentDTO instituteStudentDTO = new InstituteStudentDTO();
        instituteStudentDTO.setUserDetails(userDTO);
        instituteStudentDTO
                .setInstituteStudentDetails(InstituteStudentDetails.builder().instituteId(instituteId).build());

        Student student = checkAndCreateStudent(instituteStudentDTO);
        if (instituteStudentDTO.getInstituteStudentDetails() != null) {
            linkStudentToInstitute(student, instituteStudentDTO.getInstituteStudentDetails());
            if (instituteStudentDTO.getInstituteStudentDetails().getEnrollmentStatus().equalsIgnoreCase(LearnerSessionStatusEnum.ACTIVE.name())){
                triggerEnrollmentWorkflow(instituteStudentDTO.getInstituteStudentDetails().getInstituteId(),instituteStudentDTO.getUserDetails(),instituteStudentDTO.getInstituteStudentDetails().getPackageSessionId(),null);
            }
        }
        return ResponseEntity.ok(new StudentDTO(student));
    }

    public UserDTO createUserFromAuthService(UserDTO userDTO, String instituteId, boolean isNotify) {
        try {
            userDTO.setRootUser(true);
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(applicationName,
                    HttpMethod.POST.name(), authServerBaseUrl,
                    StudentConstants.addUserRoute + "?instituteId=" + instituteId + "&isNotify=" + isNotify, userDTO);
            return objectMapper.readValue(response.getBody(), UserDTO.class);

        } catch (Exception e) {
            throw new vacademy.io.common.exceptions.VacademyException(e.getMessage());
        }
    }

    private Student checkAndCreateStudent(InstituteStudentDTO instituteStudentDTO) {
        instituteStudentDTO.getUserDetails().setRoles(getStudentRoles());
        setRandomPasswordIfNull(instituteStudentDTO.getUserDetails());
        setRandomUserNameIfNull(instituteStudentDTO.getUserDetails());
        instituteStudentDTO.getUserDetails()
                .setUsername(instituteStudentDTO.getUserDetails().getUsername().toLowerCase());
        setEnrollmentNumberIfNull(instituteStudentDTO.getInstituteStudentDetails());
        UserDTO createdUser = createUserFromAuthService(instituteStudentDTO.getUserDetails(),
                instituteStudentDTO.getInstituteStudentDetails().getInstituteId(), true);
        instituteStudentDTO.getUserDetails().setId(createdUser.getId());
        return createStudentFromRequest(createdUser, instituteStudentDTO.getStudentExtraDetails());
    }

    private void setRandomUserNameIfNull(UserDTO userDetails) {
        if (userDetails.getUsername() == null || !StringUtils.hasText(userDetails.getUsername())) {
            userDetails.setUsername(generateUsername(userDetails.getFullName()));
        }
        userDetails.setUsername(userDetails.getUsername().toLowerCase());
    }

    private void setEnrollmentNumberIfNull(InstituteStudentDetails instituteStudentDetails) {
        if (instituteStudentDetails.getEnrollmentId() == null
                || !StringUtils.hasText(instituteStudentDetails.getEnrollmentId())) {
            instituteStudentDetails.setEnrollmentId(generateEnrollmentId());
        }
    }

    private void setRandomPasswordIfNull(UserDTO userDTO) {
        if (userDTO.getPassword() == null || !StringUtils.hasText(userDTO.getPassword())) {
            userDTO.setPassword(generatePassword());
        }
    }

    public Student createStudentFromRequest(UserDTO userDTO, StudentExtraDetails studentExtraDetails) {
        Student student = new Student();
        Optional<Student> existingStudent = getExistingStudentByUserNameAndUserId(userDTO.getUsername(),
                userDTO.getId());
        if (existingStudent.isPresent()) {
            student = existingStudent.get();
        }
        if (userDTO.getId() != null) {
            student.setUserId(userDTO.getId());
        }
        if (userDTO.getUsername() != null) {
            student.setUsername(userDTO.getUsername());
        }
        if (userDTO.getFullName() != null) {
            student.setFullName(userDTO.getFullName());
        }
        if (userDTO.getEmail() != null) {
            student.setEmail(userDTO.getEmail());
        }
        if (userDTO.getMobileNumber() != null) {
            student.setMobileNumber(userDTO.getMobileNumber());
        }
        if (userDTO.getAddressLine() != null) {
            student.setAddressLine(userDTO.getAddressLine());
        }
        if (userDTO.getProfilePicFileId() != null) {
            student.setFaceFileId(userDTO.getProfilePicFileId());
        }
        if (userDTO.getCity() != null) {
            student.setCity(userDTO.getCity());
        }
        if (userDTO.getPinCode() != null) {
            student.setPinCode(userDTO.getPinCode());
        }
        if (userDTO.getGender() != null) {
            student.setGender(userDTO.getGender());
        }
        if (userDTO.getDateOfBirth() != null) {
            student.setDateOfBirth(userDTO.getDateOfBirth());
        }
        if (userDTO.getRegion() != null) {
            student.setRegion(userDTO.getRegion());
        }

        if (studentExtraDetails != null) {
            if (studentExtraDetails.getFathersName() != null) {
                student.setFatherName(studentExtraDetails.getFathersName());
            }
            if (studentExtraDetails.getMothersName() != null) {
                student.setMotherName(studentExtraDetails.getMothersName());
            }
            if (studentExtraDetails.getParentsMobileNumber() != null) {
                student.setParentsMobileNumber(studentExtraDetails.getParentsMobileNumber());
            }
            if (studentExtraDetails.getParentsEmail() != null) {
                student.setParentsEmail(studentExtraDetails.getParentsEmail());
            }
            if (studentExtraDetails.getLinkedInstituteName() != null) {
                student.setLinkedInstituteName(studentExtraDetails.getLinkedInstituteName());
            }
            if (studentExtraDetails.getParentsToMotherEmail() != null) {
                student.setParentsToMotherEmail(studentExtraDetails.getParentsToMotherEmail());
            }
            if (studentExtraDetails.getParentsToMotherMobileNumber() != null) {
                student.setParentToMotherMobileNumber(studentExtraDetails.getParentsToMotherMobileNumber());
            }
        }
        return instituteStudentRepository.save(student);
    }

    /**
     * [REWORKED]
     * Links a student to a package session, applying re-enrollment and access day
     * policies.
     */
    public String linkStudentToInstitute(Student student, InstituteStudentDetails details) {
        try {
            // 1. Fetch the policy for the package session they are trying to join
            vacademy.io.common.institute.entity.session.PackageSession packageSession = packageSessionRepository
                    .findById(details.getPackageSessionId())
                    .orElseThrow(() -> new VacademyException(
                            "PackageSession not found with id: " + details.getPackageSessionId()));

            EnrollmentPolicySettingsDTO policy = parseEnrollmentPolicy(packageSession.getEnrollmentPolicySettings());
            if (policy == null) {
                policy = EnrollmentPolicySettingsDTO.builder().build();
            }

            // 2. Validate re-enrollment eligibility BEFORE creating/updating mapping
            validateReenrollmentEligibility(student, details, policy);

            // 3. Check for an active mapping in a *different* session (for stacking)
            Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping = getActiveDestinationMapping(
                    student, details);

            // 4. Check for an *existing* mapping in *this* session (for
            // re-enrollment/repurchase)
            Optional<StudentSessionInstituteGroupMapping> existingMapping = getExistingMapping(student, details);
            if (existingMapping.isPresent()) {
                // Scenario: Re-enrollment (EXPIRED -> ACTIVE) or Repurchase (ACTIVE -> ACTIVE)
                return updateExistingMapping(existingMapping.get(), activeDestinationMapping, details, policy);
            } else {
                // Scenario: New Enrollment
                return createNewMapping(student, activeDestinationMapping, details, policy);
            }
        } catch (VacademyException e) {
            log.error("Policy-based enrollment failed for student {}: {}", student.getUserId(), e.getMessage());
            throw e; // Re-throw the specific exception
        } catch (Exception e) {
            log.error("Failed to link student {} to institute {}: {}", student.getUserId(), details.getInstituteId(),
                    e.getMessage(), e);
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
    }

    /**
     * Validates re-enrollment eligibility based on policy settings.
     * Checks gap period for ACTIVE and EXPIRED statuses.
     * Throws VacademyException if re-enrollment is not allowed.
     */
    private void validateReenrollmentEligibility(Student student,
            InstituteStudentDetails details,
            EnrollmentPolicySettingsDTO policy) {
        if (policy == null || policy.getReenrollmentPolicy() == null) {
            return; // No policy = allow
        }

        vacademy.io.admin_core_service.features.enrollment_policy.dto.ReenrollmentPolicyDTO reenrollPolicy = policy
                .getReenrollmentPolicy();

        // Check if re-enrollment is allowed
        if (Boolean.FALSE.equals(reenrollPolicy.getAllowReenrollmentAfterExpiry())) {
            Integer gapDays = reenrollPolicy.getReenrollmentGapInDays();
            if (gapDays == null || gapDays <= 0) {
                return; // No gap specified = allow
            }

            // Find existing mapping (ACTIVE or EXPIRED)
            Optional<StudentSessionInstituteGroupMapping> existingMapping = studentSessionRepository
                    .findTopByPackageSessionIdAndUserIdAndStatusIn(
                            details.getPackageSessionId(),
                            details.getInstituteId(),
                            student.getUserId(),
                            List.of(
                                    LearnerSessionStatusEnum.ACTIVE.name(),
                                    LearnerSessionStatusEnum.EXPIRED.name()));

            if (existingMapping.isPresent()) {
                StudentSessionInstituteGroupMapping mapping = existingMapping.get();
                Date expiryDate = mapping.getExpiryDate();
                Date now = new Date();

                // If expiry date is null, it means infinity - check from updatedAt
                Date checkDate = (expiryDate != null) ? expiryDate : mapping.getUpdatedAt();

                if (checkDate != null) {
                    // Calculate days since expiry/update
                    long daysSince = (now.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24);

                    if (daysSince < gapDays) {
                        // Calculate allowed date
                        Date allowedDate = addDaysToDate(checkDate, gapDays);
                        java.time.LocalDate allowedLocalDate = allowedDate.toInstant()
                                .atZone(java.time.ZoneId.systemDefault())
                                .toLocalDate();

                        throw new VacademyException(
                                String.format("Re-enrollment is not allowed. Please try again after %s. " +
                                        "Minimum gap required: %d days.",
                                        allowedLocalDate
                                                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd")),
                                        gapDays));
                    }
                }
            }
        }
    }

    private Optional<StudentSessionInstituteGroupMapping> getActiveDestinationMapping(Student student,
            InstituteStudentDetails details) {
        if (!StringUtils.hasText(details.getDestinationPackageSessionId())) {
            return Optional.empty();
        }

        return studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                details.getDestinationPackageSessionId(),
                details.getInstituteId(),
                student.getUserId(),
                List.of(LearnerSessionStatusEnum.ACTIVE.name()) // Only check for ACTIVE
        );
    }

    /**
     * [CORRECTED]
     * Now includes EXPIRED status to correctly handle re-enrollment scenarios.
     */
    private Optional<StudentSessionInstituteGroupMapping> getExistingMapping(Student student,
            InstituteStudentDetails details) {
        return studentSessionRepository.findTopByPackageSessionIdAndUserIdAndStatusIn(
                details.getPackageSessionId(),
                details.getInstituteId(),
                student.getUserId(),
                List.of(
                        LearnerSessionStatusEnum.ACTIVE.name(),
                        LearnerSessionStatusEnum.INVITED.name(),
                        LearnerSessionStatusEnum.TERMINATED.name(),
                        LearnerSessionStatusEnum.INACTIVE.name(),
                        LearnerSessionStatusEnum.EXPIRED.name() // <-- ADDED
                ));
    }

    /**
     * [REWORKED]
     * Handles updates to an existing mapping, applying policy logic for
     * re-enrollment and repurchasing.
     */
    private String updateExistingMapping(
            StudentSessionInstituteGroupMapping mapping,
            Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping,
            InstituteStudentDetails details,
            EnrollmentPolicySettingsDTO policy) {
        Date now = new Date();
        LearnerSessionStatusEnum currentStatus = LearnerSessionStatusEnum.valueOf(mapping.getStatus());

        // --- 1. Re-enrollment Gap Logic (Point 6: Demo Scenario) ---
        if (currentStatus == LearnerSessionStatusEnum.EXPIRED
                || currentStatus == LearnerSessionStatusEnum.TERMINATED
                || currentStatus == LearnerSessionStatusEnum.ACTIVE) {

            ReenrollmentPolicyDTO reenrollPolicy = policy.getReenrollmentPolicy();
            if (reenrollPolicy != null && !Boolean.TRUE.equals(reenrollPolicy.getAllowReenrollmentAfterExpiry())) {

                Integer gapDays = reenrollPolicy.getReenrollmentGapInDays();
                // Base check on expiry date, or last update time if expiry was null
                Date lastEventDate = mapping.getExpiryDate() != null ? mapping.getExpiryDate() : mapping.getUpdatedAt();

                if (gapDays != null && gapDays > 0 && lastEventDate != null) {
                    Date reEnrollmentAllowedDate = addDaysToDate(lastEventDate, gapDays);

                    if (now.before(reEnrollmentAllowedDate)) {
                        log.warn("Re-enrollment blocked for user {} on packageSession {}. Gap period active until {}.",
                                mapping.getUserId(), mapping.getPackageSession().getId(), reEnrollmentAllowedDate);

                        // Convert Date to LocalDate for formatting
                        LocalDate allowedDate = reEnrollmentAllowedDate.toInstant()
                                .atZone(ZoneId.systemDefault())
                                .toLocalDate();

                        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

                        throw new VacademyException(
                                "Re-enrollment is not allowed for this course at this time. Please try again after "
                                        + allowedDate.format(formatter));
                    }
                }
            }
        }

        // --- 2. Determine Base Date for Expiry Calculation (Point 5: Repurchase) ---
        Date baseDate = now;
        ActiveRepurchaseBehavior behavior = ActiveRepurchaseBehavior.STACK; // Default
        if (policy.getReenrollmentPolicy() != null
                && policy.getReenrollmentPolicy().getActiveRepurchaseBehavior() != null) {
            behavior = policy.getReenrollmentPolicy().getActiveRepurchaseBehavior();
        }

        if (currentStatus == LearnerSessionStatusEnum.ACTIVE && behavior == ActiveRepurchaseBehavior.STACK) {
            if (mapping.getExpiryDate() != null && mapping.getExpiryDate().after(now)) {
                baseDate = mapping.getExpiryDate(); // STACK: Base is current expiry date
            }
        }
        if (activeDestinationMapping.isPresent() && activeDestinationMapping.get().getSubOrg() == null
                && StringUtils.hasText(details.getSubOrgId())) {
            mapping.setSubOrg(instituteRepository.findById(details.getSubOrgId())
                    .orElseThrow(() -> new VacademyException("Sub Org not found")));
        }
        if (activeDestinationMapping.isPresent() && activeDestinationMapping.get().getSubOrg() == null
                && StringUtils.hasText(details.getCommaSeparatedOrgRoles())) {
            mapping.setCommaSeparatedOrgRoles(details.getCommaSeparatedOrgRoles());
        }
        return studentSessionRepository.save(mapping).getId();
    }

    /**
     * [REWORKED]
     * Creates a new mapping, applying policy logic. Uses JPA save() instead of
     * native query.
     */
    private String createNewMapping(
            Student student,
            Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping,
            InstituteStudentDetails details, EnrollmentPolicySettingsDTO policySettingsDTO) {
        UUID studentSessionId = UUID.randomUUID();
        Date baseDate = determineBaseDate(null, activeDestinationMapping);

        studentSessionRepository.addStudentToInstitute(
                studentSessionId.toString(),
                student.getUserId(),
                details.getEnrollmentDate() == null ? new Date() : details.getEnrollmentDate(),
                details.getEnrollmentStatus(),
                generateEnrollmentId(),
                details.getGroupId(),
                details.getInstituteId(),
                makeExpiryDate(baseDate, details.getAccessDays()),
                details.getPackageSessionId(),
                details.getDestinationPackageSessionId(),
                details.getUserPlanId(),
                details.getSubOrgId(),
                details.getCommaSeparatedOrgRoles());

        return studentSessionId.toString();
    }

    private Date determineBaseDate(
            StudentSessionInstituteGroupMapping currentMapping,
            Optional<StudentSessionInstituteGroupMapping> activeDestinationMapping) {
        Date now = new Date();

        if (activeDestinationMapping.isPresent()) {
            Date destExpiry = activeDestinationMapping.get().getExpiryDate();
            if (destExpiry != null && destExpiry.after(now)) {
                return destExpiry; // Extend from destination’s expiry
            }
        }

        if (currentMapping != null &&
                LearnerSessionStatusEnum.ACTIVE.name().equalsIgnoreCase(currentMapping.getStatus()) &&
                currentMapping.getExpiryDate() != null) {
            return currentMapping.getExpiryDate().after(now) ? currentMapping.getExpiryDate() : now;
        }

        return now;
    }

    public String shiftStudentBatch(
            StudentSessionInstituteGroupMapping invitedPackageSession,
            String newStatus) {
        try {
            String userId = invitedPackageSession.getUserId();
            String instituteId = invitedPackageSession.getInstitute().getId();

            StudentSessionInstituteGroupMapping mappingToUse = findOrCreateMapping(
                    instituteId, userId, newStatus, invitedPackageSession);

            markOldMappingDeleted(invitedPackageSession);

            return studentSessionRepository.save(mappingToUse).getId();
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("Failed to link student to institute: " + e.getMessage());
        }
    }

    private StudentSessionInstituteGroupMapping findOrCreateMapping(
            String instituteId,
            String userId,
            String newStatus,
            StudentSessionInstituteGroupMapping invitedPackageSession) {
        Optional<StudentSessionInstituteGroupMapping> existingMappingOpt = studentSessionRepository
                .findTopByPackageSessionIdAndUserIdAndStatusIn(
                        invitedPackageSession.getDestinationPackageSession().getId(), instituteId, userId,
                        List.of(LearnerSessionStatusEnum.ACTIVE.name()));
        StudentSessionInstituteGroupMapping activePackageSession;
        if (existingMappingOpt.isPresent()) {
            activePackageSession = existingMappingOpt.get();
        } else {
            activePackageSession = new StudentSessionInstituteGroupMapping();
            activePackageSession.setInstitute(invitedPackageSession.getInstitute());
            activePackageSession.setUserId(invitedPackageSession.getUserId());
            activePackageSession.setInstituteEnrolledNumber(invitedPackageSession.getInstituteEnrolledNumber());
            activePackageSession.setEnrolledDate(new Date());
            activePackageSession.setStatus(newStatus);
            activePackageSession.setPackageSession(invitedPackageSession.getDestinationPackageSession());
            activePackageSession.setUserPlanId(invitedPackageSession.getUserPlanId());
            activePackageSession.setType(invitedPackageSession.getType());
            activePackageSession.setTypeId(invitedPackageSession.getTypeId());
        }
        if (invitedPackageSession.getSubOrg() != null) {
            activePackageSession.setSubOrg(invitedPackageSession.getSubOrg());
        }
        if (StringUtils.hasText(invitedPackageSession.getCommaSeparatedOrgRoles())) {
            activePackageSession.setCommaSeparatedOrgRoles(invitedPackageSession.getCommaSeparatedOrgRoles());
        }
        Date baseDate = activePackageSession.getExpiryDate() != null ? activePackageSession.getExpiryDate()
                : new Date();
        activePackageSession
                .setExpiryDate(calculateNewExpiryDate(baseDate, invitedPackageSession.getUserPlanId(), null));
        return activePackageSession;
    }

    /**
     * Wrapper method for backward compatibility.
     * Calculates expiry date based on PaymentPlan from UserPlan.
     */
    private Date getExpiryDateBasedOnPaymentPlan(StudentSessionInstituteGroupMapping mapping, String userPlanId) {
        Date baseDate = mapping.getExpiryDate() != null ? mapping.getExpiryDate() : new Date();
        return calculateNewExpiryDate(baseDate, userPlanId, null);
    }

    private void updateMappingFields(
            StudentSessionInstituteGroupMapping mappingToUse,
            StudentSessionInstituteGroupMapping sourceMapping,
            String newStatus) {
        mappingToUse.setEnrolledDate(new Date());
        mappingToUse.setStatus(newStatus);

        if (sourceMapping.getInstituteEnrolledNumber() != null) {
            mappingToUse.setInstituteEnrolledNumber(sourceMapping.getInstituteEnrolledNumber());
        }

        if (sourceMapping.getExpiryDate() != null) {
            mappingToUse.setExpiryDate(sourceMapping.getExpiryDate());
        }
    }

    /**
     * [NEW HELPER]
     * Calculates the new expiry date based on V2 (UserPlan) or V1
     * (legacyAccessDays).
     * 
     * @param baseDate         The date to add validity to (either 'now' or a future
     *                         expiry date).
     * @param userPlanId       The ID of the V2 UserPlan.
     * @param legacyAccessDays The V1 access days string.
     * @return A new Date, or null if access is unlimited.
     */
    private Date calculateNewExpiryDate(Date baseDate, String userPlanId, String legacyAccessDays) {
        Integer validityDays = getValidityDaysFromUserPlan(userPlanId);

        if (validityDays == null && StringUtils.hasText(legacyAccessDays)) {
            // Fallback to V1 logic if no V2 plan is found
            try {
                validityDays = Integer.parseInt(legacyAccessDays);
            } catch (NumberFormatException e) {
                log.warn("Could not parse legacyAccessDays: {}", legacyAccessDays);
                validityDays = null;
            }
        }

        if (validityDays == null) {
            // Unlimited access
            return null;
        }

        if (validityDays <= 0) {
            // No extension, just return the base date (e.g., for free plans with 0 days)
            return baseDate;
        }

        return addDaysToDate(baseDate, validityDays);
    }

    /**
     * [NEW HELPER]
     * Utility to add days to a date.
     */
    private Date addDaysToDate(Date date, int days) {
        if (date == null) {
            return null;
        }
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(date);
        calendar.add(Calendar.DAY_OF_YEAR, days);
        return calendar.getTime();
    }

    /**
     * [REFACTORED]
     * Renamed from getExpiryDateBasedOnPaymentPlan.
     * Returns the number of validity days from a UserPlan, or null for unlimited.
     */
    private Integer getValidityDaysFromUserPlan(String userPlanId) {
        if (userPlanId == null)
            return null;

        UserPlan userPlan = userPlanService.findById(userPlanId);
        if (userPlan == null)
            return null;

        EnrollInvite enrollInvite = userPlan.getEnrollInvite();
        PaymentOption paymentOption = userPlan.getPaymentOption();
        PaymentPlan paymentPlan = userPlan.getPaymentPlan();

        Integer validityDays = null;

        if (paymentOption != null) {
            String type = paymentOption.getType();

            if (PaymentOptionType.ONE_TIME.name().equalsIgnoreCase(type) ||
                    PaymentOptionType.SUBSCRIPTION.name().equalsIgnoreCase(type)) {

                validityDays = (paymentPlan != null) ? paymentPlan.getValidityInDays() : null;

            } else if (PaymentOptionType.DONATION.name().equalsIgnoreCase(type)) {

                validityDays = (enrollInvite != null) ? enrollInvite.getLearnerAccessDays() : null;

            } else { // Defaults to FREE
                validityDays = (enrollInvite != null) ? enrollInvite.getLearnerAccessDays() : null;
            }
        } else if (enrollInvite != null) {
            // Fallback for cases where paymentOption might be null (e.g., pure free invite)
            validityDays = enrollInvite.getLearnerAccessDays();
        }

        return validityDays; // Will be null if unlimited, or an Integer
    }

    private void markOldMappingDeleted(StudentSessionInstituteGroupMapping mapping) {
        if (mapping == null)
            return; // safety check

        String userId = mapping.getUserId();
        String packageSessionId = mapping.getPackageSession() != null ? mapping.getPackageSession().getId() : null;
        String instituteId = mapping.getInstitute() != null ? mapping.getInstitute().getId() : null;
        String destinationPackageSessionId = mapping.getDestinationPackageSession() != null
                ? mapping.getDestinationPackageSession().getId()
                : null;
        String deletedStatus = LearnerSessionStatusEnum.DELETED.name();

        // Only call delete if at least userId and status are available
        if (userId != null) {
            studentSessionRepository.deleteByUniqueConstraint(
                    userId,
                    destinationPackageSessionId,
                    packageSessionId,
                    instituteId,
                    deletedStatus);
        }

        // Mark current mapping as deleted
        mapping.setStatus(deletedStatus);
        studentSessionRepository.save(mapping);
    }

    public List<String> getStudentRoles() {
        List<String> roles = new ArrayList<>();
        roles.add(StudentConstants.studentRole);
        return roles;
    }

    public Date makeExpiryDate(Date enrollmentDate, String accessDays) {
        try {
            if (enrollmentDate == null || accessDays == null) {
                return null;
            }
            return addDaysToDate(enrollmentDate, Integer.parseInt(accessDays));
        } catch (Exception e) {
            log.warn("Failed to parse and add accessDays: {}", e.getMessage());
        }
        return null;
    }

    private Optional<Student> getExistingStudentByUserNameAndUserId(String username, String userId) {
        return instituteStudentRepository.findTopByUserIdOrderByCreatedAtDesc(userId);
    }

    public InstituteStudentDTO updateAsPerConfig(InstituteStudentDTO instituteStudentDTO,
            BulkUploadInitRequest bulkUploadInitRequest) {
        if (Objects.isNull(bulkUploadInitRequest)) {
            return instituteStudentDTO;
        }
        BulkUploadInitRequest.AutoGenerateConfig autoConfig = bulkUploadInitRequest.getAutoGenerateConfig();
        BulkUploadInitRequest.ExpiryAndStatusConfig expiryAndStatusConfig = bulkUploadInitRequest
                .getExpiryAndStatusConfig();
        BulkUploadInitRequest.OptionalFieldsConfig optionalFieldsConfig = bulkUploadInitRequest
                .getOptionalFieldsConfig();

        // Auto-generate username if required
        if (autoConfig.isAutoGenerateUsername()) {
            instituteStudentDTO.getUserDetails()
                    .setUsername(generateUsername(instituteStudentDTO.getUserDetails().getFullName()).toLowerCase());
        }

        // Auto-generate password if required
        if (autoConfig.isAutoGeneratePassword()
                || StringUtils.isEmpty(instituteStudentDTO.getUserDetails().getPassword())) {
            instituteStudentDTO.getUserDetails().setPassword(generatePassword());
        }

        // Auto-generate enrollment number if required
        if (autoConfig.isAutoGenerateEnrollmentId()) {
            instituteStudentDTO.getInstituteStudentDetails().setEnrollmentId(generateEnrollmentId());
        }

        // Set expiry days if included
        if (expiryAndStatusConfig.isIncludeExpiryDays()) {
            instituteStudentDTO.getInstituteStudentDetails()
                    .setAccessDays(bulkUploadInitRequest.getExpiryAndStatusConfig().getExpiryDays().toString());
        }

        // Set enrollment status if included
        if (expiryAndStatusConfig.isIncludeEnrollmentStatus()) {
            instituteStudentDTO.getInstituteStudentDetails()
                    .setEnrollmentStatus(bulkUploadInitRequest.getExpiryAndStatusConfig().getEnrollmentStatus());
        }

        return instituteStudentDTO;
    }

    private String generateUsername(String fullName) {
        // Ensure full name has at least 4 characters, else pad with "X"
        String namePart = fullName.replaceAll("\\s+", "").substring(0, Math.min(fullName.length(), 4)).toLowerCase();
        if (namePart.length() < 4) {
            namePart = String.format("%-4s", namePart).replace(' ', 'X');
        }

        // Generate 4 random digits
        String randomDigits = RandomStringUtils.randomNumeric(4);

        return namePart + randomDigits;
    }

    private String generatePassword() {
        return RandomStringUtils.randomAlphanumeric(8);
    }

    private String generateEnrollmentId() {
        return RandomStringUtils.randomNumeric(6);
    }

    public String addStudent(UserDTO userDTO) {
        return createStudentFromRequest(userDTO, null).getId();
    }

    public void triggerEnrollmentWorkflow(String instituteId, UserDTO userDTO, String packageSessionId, Institute subOrg) {
        Map<String, Object> contextData = new HashMap<>();
        contextData.put("user", userDTO);
        contextData.put("packageSessionIds", packageSessionId);
        contextData.put("subOrg",subOrg);
        Optional<PackageSession>packageSession = packageSessionRepository.findById(packageSessionId);
        if (packageSession.isEmpty()){
            throw new VacademyException("Package Session Not Found");
        }
        contextData.put("packageId",packageSession.get().getPackageEntity().getId());
        workflowTriggerService.handleTriggerEvents(WorkflowTriggerEvent.LEARNER_BATCH_ENROLLMENT.name(),packageSessionId,instituteId,contextData);
    }
}
