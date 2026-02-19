package vacademy.io.admin_core_service.features.admission.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionRequestDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponseDTO;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantStageRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicationStageRepository;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;
import vacademy.io.common.auth.dto.ParentWithChildDTO;

@Service
public class AdmissionService {

    private static final Logger logger = LoggerFactory.getLogger(AdmissionService.class);

    @Autowired
    private AuthService authService;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private ApplicantStageRepository applicantStageRepository;

    @Autowired
    private ApplicationStageRepository applicationStageRepository;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private InstituteCustomFieldRepository instituteCustomFieldRepository;

    @Autowired
    private NotificationService notificationService; // For Default Fallback

    @Autowired
    private SendUniqueLinkService sendUniqueLinkService; // For Template Emails

    @Autowired
    private NotificationEventConfigRepository notificationEventConfigRepository;

    @Autowired
    private TemplateRepository templateRepository;

    @Transactional
    public AdmissionResponseDTO submitAdmissionForm(AdmissionRequestDTO request, CustomUserDetails userDetails) {
        logger.info("Processing Admission Form for Institute: {}, Source: {}, SourceId: {}",
                request.getInstituteId(), request.getSource(), request.getSourceId());

        // 1. User Management (Parent & Child)
        UserManagementResult userResult = handleUserCreation(request);

        // 2. Student Persistence
        Student student = createStudentProfile(userResult.childUser(), request);
        saveCustomFieldValues(request.getCustomFieldValues(), student.getId(), request.getInstituteId());

        // 3. Audience Response (AR) Logic
        AudienceResponse ar = handleAudienceResponse(request, userResult.parentUser(), userResult.childUser(), student);

        // 4. Applicant & Stage Logic (Transition/Creation)
        Applicant applicant = handleApplicantAndStage(request, ar, userResult.parentUser());

        // 5. Notification (Welcome Email)
        sendAdmissionWelcomeEmail(userResult.parentUser(), userResult.childUser(), userResult.sendCredentials(),
                userResult.password(), request.getInstituteId());

        return AdmissionResponseDTO.builder()
                .applicantId(applicant.getId().toString())
                .trackingId(applicant.getTrackingId())
                .workflowType("ADMISSION")
                .overallStatus("ADMISSION_INITIATED")
                .currentStageId(applicant.getApplicationStageId())
                .message("Admission processed successfully.")
                .isTransition(false)
                .build();
    }

    // --- Helper Methods ---

    private UserManagementResult handleUserCreation(AdmissionRequestDTO request) {
        // Step 1: Check Parent
        UserDTO parentUser = null;
        boolean sendCredentials = false;
        String password = null;

        try {
            // Check existence by Mobile Number
            parentUser = authService.getUserByMobileNumber(request.getFatherMobile());

            if (parentUser == null) {
                // NEW PARENT
                UserDTO parentRequest = new UserDTO();
                parentRequest.setFullName(request.getFatherName());
                parentRequest.setEmail(request.getFatherEmail());
                parentRequest.setMobileNumber(request.getFatherMobile());
                parentRequest.setRoles(java.util.List.of("PARENT"));

                parentUser = authService.createUserFromAuthService(parentRequest, request.getInstituteId(), false);

                if (parentUser.getPassword() != null && !parentUser.getPassword().isEmpty()) {
                    sendCredentials = true;
                    password = parentUser.getPassword();
                    logger.info("New Parent User created: {}", parentUser.getId());
                }
            } else {
                // EXISTING PARENT
                logger.info("Existing Parent User found: {}", parentUser.getId());
                // Fetch password for email inclusion
                UserDTO userWithPass = authService.getUsersFromAuthServiceWithPasswordByUserId(parentUser.getId());
                if (userWithPass != null) {
                    password = userWithPass.getPassword();
                    sendCredentials = true; // Treating as "New Entry" for credentials
                }
            }

        } catch (Exception e) {
            throw new VacademyException("Failed to manage parent user: " + e.getMessage());
        }

        // Step 2: Check duplicate BEFORE creating child user
        String childName = buildFullName(request.getFirstName(), request.getLastName());
        String parentMobile = request.getFatherMobile();

        // Check 1: Robust check via Auth Service (Parent ID -> Children)
        if (parentUser != null) {
            try {
                List<ParentWithChildDTO> parentChildren = authService
                        .getUsersWithChildren(List.of(parentUser.getId()));

                final UserDTO finalParentUser = parentUser; // Create effectively final variable for lambda

                // Check if any child has the same name (case-insensitive)
                boolean duplicateInAuth = false;
                if (parentChildren != null) {
                    duplicateInAuth = parentChildren.stream()
                            .filter(dto -> dto.getParent() != null
                                    && dto.getParent().getId().equals(finalParentUser.getId()))
                            .map(ParentWithChildDTO::getChild)
                            .filter(Objects::nonNull)
                            .anyMatch(child -> child.getFullName().equalsIgnoreCase(childName));
                }

                if (duplicateInAuth) {
                    throw new VacademyException(
                            "A student named '" + childName + "' is already registered under this parent account.");
                }
            } catch (VacademyException ve) {
                if (ve.getMessage().contains("already registered"))
                    throw ve;
                logger.warn("Auth Service child check failed, proceeding to fallback: {}", ve.getMessage());
            } catch (Exception e) {
                logger.warn("Auth Service child check failed, proceeding to fallback: {}", e.getMessage());
            }
        }

        // Check 2: Fallback check via Student Repository (Mobile + Name)
        // Useful for legacy data or if Auth Service check was skipped/failed
        if (parentMobile != null && !parentMobile.isBlank() && childName != null && !childName.isBlank()) {
            Optional<Student> existingStudent = instituteStudentRepository
                    .findByParentMobileAndChildFullName(parentMobile, childName);
            if (existingStudent.isPresent()) {
                throw new VacademyException(
                        "A student named '" + childName + "' is already admitted under this parent (mobile match).");
            }
        }

        // Step 3: Create Child user (username = mobile if provided, else
        // auto-generated)
        UserDTO childUser = null;
        try {
            UserDTO childRequest = new UserDTO();
            childRequest.setFullName(childName);
            // Use mobile as username if provided; otherwise auto-generate a unique one
            String childUsername = (request.getMobileNumber() != null && !request.getMobileNumber().isBlank())
                    ? request.getMobileNumber()
                    : "stud_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            childRequest.setUsername(childUsername);
            childRequest.setEmail("child_" + UUID.randomUUID().toString().substring(0, 8) + "@vacademy.io");
            childRequest.setRoles(java.util.List.of("STUDENT"));
            childRequest.setLinkedParentId(parentUser.getId());

            childUser = authService.createUserFromAuthService(childRequest, request.getInstituteId(), false);
            logger.info("Child User created: {}", childUser.getId());

        } catch (Exception e) {
            throw new VacademyException("Failed to manage child user: " + e.getMessage());
        }

        return new UserManagementResult(parentUser, childUser, sendCredentials, password);
    }

    private Student createStudentProfile(UserDTO childUser, AdmissionRequestDTO req) {
        Student student = new Student(childUser);
        student.setLinkedInstituteName("Vacademy");

        // --- Screen 1: Student Details (columns present in DB) ---
        student.setGender(req.getGender());
        student.setApplyingForClass(req.getClassApplyingFor());
        student.setAdmissionNo(req.getAdmissionNo());
        student.setDateOfAdmission(parseDate(req.getDateOfAdmission()));
        student.setDateOfBirth(parseDate(req.getDateOfBirth()));
        student.setMobileNumber(req.getMobileNumber());
        student.setAdmissionType(req.getAdmissionType());
        // TODO: restore once V119 migration adds: section, has_transport, student_type,
        // class_group

        // Aadhaar maps to id_number + id_type
        if (req.getStudentAadhaar() != null && !req.getStudentAadhaar().isBlank()) {
            student.setIdNumber(req.getStudentAadhaar());
            student.setIdType("AADHAAR");
        }

        // --- Screen 2: Previous School & Demographics (columns present in DB) ---
        student.setPreviousSchoolName(req.getPreviousSchoolName());
        student.setLastClassAttended(req.getPreviousClass());
        student.setPreviousSchoolBoard(req.getPreviousBoard());
        student.setLastExamResult(req.getPreviousPercentage());
        // student.setCaste(req.getCaste()); // TODO: restore once migration adds caste
        // column
        student.setMotherTongue(req.getMotherTongue());
        student.setBloodGroup(req.getBloodGroup());
        student.setNationality(req.getNationality());
        // TODO: restore once V119 migration adds: year_of_passing,
        // previous_admission_no, religion, how_did_you_know

        // --- Screen 3: Parent Details (columns present in DB) ---
        student.setFatherName(req.getFatherName());
        student.setParentsMobileNumber(req.getFatherMobile());
        student.setParentsEmail(req.getFatherEmail());

        student.setMotherName(req.getMotherName());
        student.setParentToMotherMobileNumber(req.getMotherMobile());
        student.setParentsToMotherEmail(req.getMotherEmail());

        student.setGuardianName(req.getGuardianName());
        student.setGuardianMobile(req.getGuardianMobile());
        // TODO: restore once V119 migration adds:
        // father_aadhaar/qualification/occupation,
        // mother_aadhaar/qualification/occupation

        // --- Screen 4: Address Details (columns present in DB) ---
        student.setAddressLine(req.getCurrentAddress());
        student.setCity(req.getCurrentLocality());
        student.setPinCode(req.getCurrentPinCode());
        // TODO: restore once V119 migration adds: permanent_address, permanent_locality

        return instituteStudentRepository.save(student);
    }

    /**
     * Safely parse an ISO date string ("yyyy-MM-dd") to java.util.Date.
     * Returns null if input is null/blank or unparseable.
     */
    private Date parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank())
            return null;
        try {
            return new SimpleDateFormat("yyyy-MM-dd").parse(dateStr);
        } catch (ParseException e) {
            logger.warn("Could not parse date string '{}', storing null", dateStr);
            return null;
        }
    }

    private void saveCustomFieldValues(Map<String, String> customValues, String studentId, String instituteId) {
        if (customValues == null || customValues.isEmpty())
            return;

        List<CustomFieldValues> toSave = new ArrayList<>();
        for (Map.Entry<String, String> entry : customValues.entrySet()) {
            String fieldId = entry.getKey();
            String value = entry.getValue();
            if (value == null || value.isBlank())
                continue;

            boolean isLinked = instituteCustomFieldRepository.existsByInstituteIdAndCustomFieldIdAndStatus(instituteId,
                    fieldId, "ACTIVE");
            if (isLinked) {
                toSave.add(CustomFieldValues.builder()
                        .customFieldId(fieldId)
                        .sourceType("STUDENT")
                        .sourceId(studentId)
                        .value(value)
                        .build());
            }
        }
        if (!toSave.isEmpty()) {
            customFieldValuesRepository.saveAll(toSave);
        }
    }

    private AudienceResponse handleAudienceResponse(AdmissionRequestDTO req, UserDTO parent, UserDTO child,
            Student student) {
        List<AudienceResponse> existing = audienceResponseRepository.findByUserIdOrStudentUserId(parent.getId(),
                child.getId());
        // 1. Prioritize finding AR strictly linked to this child
        Optional<AudienceResponse> reuse = existing.stream()
                .filter(ar -> ar.getStudentUserId() != null && ar.getStudentUserId().equals(child.getId()))
                .findFirst();

        // 2. If not found, look for "unclaimed" AR belonging to parent (no child linked
        // yet)
        if (reuse.isEmpty()) {
            reuse = existing.stream()
                    .filter(ar -> ar.getUserId().equals(parent.getId()) && ar.getStudentUserId() == null)
                    // Optional: maybe sort by createdAt desc?
                    .findFirst();
        }

        if (reuse.isPresent()) {
            AudienceResponse ar = reuse.get();
            ar.setOverallStatus("ADMISSION");

            // Ensure child is linked (critical for unclaimed leads)
            if (ar.getStudentUserId() == null) {
                ar.setStudentUserId(child.getId());
                logger.info("Linking unclaimed AudienceResponse {} to child user {}", ar.getId(), child.getId());
            }

            // Update destination if provided
            if (req.getDestinationPackageSessionId() != null) {
                ar.setDestinationPackageSessionId(req.getDestinationPackageSessionId());
            }
            return audienceResponseRepository.save(ar);
        }

        AudienceResponse ar = AudienceResponse.builder()
                .userId(parent.getId())
                .studentUserId(child.getId())
                .sourceType("MANUAL_ADMISSION")
                .sourceId(req.getSourceId())
                .destinationPackageSessionId(req.getDestinationPackageSessionId())
                .parentName(parent.getFullName())
                .parentEmail(parent.getEmail())
                .parentMobile(parent.getMobileNumber())
                .overallStatus("ADMISSION")
                .build();
        return audienceResponseRepository.save(ar);
    }

    private Applicant handleApplicantAndStage(AdmissionRequestDTO req, AudienceResponse ar, UserDTO parent) {

        // Step 1: Look up admin-configured ADMISSION stage (consistent with application
        // form flow)
        ApplicationStage admissionStage = applicationStageRepository
                .findFirstStage(req.getInstituteId(), req.getSource(), req.getSourceId(), "ADMISSION")
                .orElseThrow(() -> new VacademyException(
                        "No ADMISSION stage configured for this institute/source. Please configure it first."));

        // Step 2: Find existing applicant from AudienceResponse
        Applicant applicant = null;
        if (ar.getApplicantId() != null) {
            try {
                applicant = applicantRepository.findById(UUID.fromString(ar.getApplicantId())).orElse(null);
            } catch (IllegalArgumentException e) {
                logger.warn("Invalid UUID in AR applicantId: {}", ar.getApplicantId());
            }
        }

        if (applicant == null) {
            // CREATE NEW applicant
            String trackingId = "ADM-" + String.format("%06d", new Random().nextInt(999999));
            applicant = new Applicant();
            applicant.setWorkflowType("ADMISSION");
            applicant.setTrackingId(trackingId);
            applicant.setOverallStatus("ADMISSION_INITIATED");
            applicant.setApplicationStageId(admissionStage.getId().toString());
            applicant.setApplicationStageStatus("INITIATED");
            applicant = applicantRepository.save(applicant);

            ar.setApplicantId(applicant.getId().toString());
            audienceResponseRepository.save(ar);

        } else {
            // EXISTING applicant — check idempotency
            if ("ADMISSION".equals(applicant.getWorkflowType())
                    && admissionStage.getId().toString().equals(applicant.getApplicationStageId())) {
                logger.info("Applicant {} already in ADMISSION workflow at this stage. Skipping.",
                        applicant.getId());
                return applicant;
            }

            // Transition to ADMISSION workflow
            applicant.setWorkflowType("ADMISSION");
            applicant.setOverallStatus("ADMISSION_INITIATED");
            applicant.setApplicationStageId(admissionStage.getId().toString());
            applicant.setApplicationStageStatus("INITIATED");
            applicant = applicantRepository.save(applicant);
        }

        // Step 3: Create ApplicantStage (per-student stage record — consistent with
        // application form flow)
        String configJson = admissionStage.getConfigJson();
        if (configJson == null || configJson.isEmpty()) {
            configJson = "{}";
        }
        ApplicantStage applicantStage = ApplicantStage.builder()
                .applicantId(applicant.getId().toString())
                .stageId(admissionStage.getId().toString())
                .stageStatus("COMPLETED")
                .responseJson(configJson)
                .build();
        applicantStageRepository.save(applicantStage);

        // Step 4: Mark applicant stage as COMPLETED (admission is a terminal single
        // step)
        applicant.setApplicationStageStatus("COMPLETED");
        applicant.setOverallStatus("ADMISSION_COMPLETED");
        return applicantRepository.save(applicant);
    }

    private void sendAdmissionWelcomeEmail(UserDTO parent, UserDTO child, boolean sendCreds, String password,
            String instituteId) {
        try {
            Optional<NotificationEventConfig> configOpt = notificationEventConfigRepository
                    .findByEventAndSourceType(
                            NotificationEventType.ADMISSION_FORM_SUBMISSION,
                            NotificationSourceType.APPLICATION_STAGE)
                    .stream().findFirst();

            boolean sentViaTemplate = false;

            if (configOpt.isPresent() && configOpt.get().getTemplateId() != null) {
                // Configured Template Found
                String templateId = configOpt.get().getTemplateId();
                Optional<Template> templateOpt = templateRepository.findById(templateId);

                if (templateOpt.isPresent()) {
                    NotificationTemplateVariables vars = NotificationTemplateVariables.builder()
                            .userFullName(parent.getFullName())
                            .userEmail(parent.getEmail())
                            .childName(child.getFullName())
                            .instituteName("Vacademy")
                            .build();

                    if (sendCreds && password != null) {
                        vars.setUserPassword(password);
                        vars.setUserName(parent.getEmail());
                    }

                    sendUniqueLinkService.sendEmailWithTemplate(instituteId, parent, templateOpt.get(), vars);
                    sentViaTemplate = true;
                }
            }

            if (!sentViaTemplate) {
                // FALLBACK DEFAULT EMAIL
                logger.info("No Admission Template found configuration. Sending Default Fallback Email.");
                String body = "Dear " + parent.getFullName() + ",<br><br>" +
                        "Welcome to Vacademy! Your admission for <b>" + child.getFullName() + "</b> is confirmed.<br>";

                if (sendCreds && password != null) {
                    body += "<br>Here are your login credentials:<br>" +
                            "Username: " + parent.getEmail() + "<br>" +
                            "Password: " + password + "<br>";
                }

                body += "<br>Regards,<br>Team Vacademy";

                GenericEmailRequest emailReq = new GenericEmailRequest();
                emailReq.setTo(parent.getEmail());
                emailReq.setSubject("Admission Confirmation - Vacademy");
                emailReq.setBody(body);
                notificationService.sendGenericHtmlMail(emailReq, instituteId);
            }
        } catch (Exception e) {
            logger.error("Failed to send Admission Welcome Email", e);
        }
    }

    private record UserManagementResult(UserDTO parentUser, UserDTO childUser, boolean sendCredentials,
            String password) {
    }

    private String buildFullName(String first, String last) {
        StringBuilder sb = new StringBuilder();
        if (first != null && !first.isBlank())
            sb.append(first.trim());
        if (last != null && !last.isBlank()) {
            if (sb.length() > 0)
                sb.append(" ");
            sb.append(last.trim());
        }
        return sb.length() > 0 ? sb.toString() : "";
    }
}
