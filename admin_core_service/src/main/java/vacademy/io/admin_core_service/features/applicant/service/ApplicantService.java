package vacademy.io.admin_core_service.features.applicant.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.applicant.dto.*;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantStageRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicationStageRepository;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.ParentWithChildDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Service
public class ApplicantService {

        @Autowired
        private ApplicantRepository applicantRepository;

        @Autowired
        private ApplicationStageRepository applicationStageRepository;

        @Autowired
        private ApplicantStageRepository applicantStageRepository;

        @Autowired
        private AudienceResponseRepository audienceResponseRepository;

        @Autowired
        private EnquiryRepository enquiryRepository;

        @Autowired
        private AuthService authService;

        @Autowired
        private InstituteStudentRepository instituteStudentRepository;

        @Autowired
        private AudienceRepository audienceRepository;

        @Autowired
        private CustomFieldValuesRepository customFieldValuesRepository;

        @Autowired
        private CustomFieldRepository customFieldRepository;

        @Autowired
        private InstituteCustomFieldRepository instituteCustomFieldRepository;

        private static final Logger logger = LoggerFactory.getLogger(ApplicantService.class);

        private final ObjectMapper objectMapper = new ObjectMapper();

        // Standard fields mapped to Student table columns - any other keys are custom
        // fields
        private static final Set<String> STANDARD_FIELD_KEYS = Set.of(
                        "parent_name", "parent_phone", "parent_email",
                        "child_name", "child_dob", "child_gender",
                        "address_line", "city", "pin_code", "father_name", "mother_name",
                        "id_number", "id_type",
                        "previous_school_name", "previous_school_board", "last_class_attended",
                        "last_exam_result", "subjects_studied",
                        "applying_for_class", "academic_year", "board_preference",
                        "tc_number", "tc_issue_date", "tc_pending",
                        "has_special_education_needs", "is_physically_challenged",
                        "medical_conditions", "dietary_restrictions",
                        "blood_group", "mother_tongue", "languages_known", "category", "nationality");

        /**
         * Create a new Application Stage configuration
         */
        @Transactional
        public String createApplicationStage(ApplicationStageDTO stageDTO) {
                ApplicationStage stage = ApplicationStage.builder()
                                .stageName(stageDTO.getStageName())
                                .sequence(stageDTO.getSequence())
                                .source(stageDTO.getSource())
                                .sourceId(stageDTO.getSourceId())
                                .instituteId(stageDTO.getInstituteId())
                                .configJson(stageDTO.getConfigJson())
                                .type(stageDTO.getType())
                                .build();

                return applicationStageRepository.save(stage).getId().toString();
        }

        /**
         * Onboard a new Applicant for a given Application Stage
         */
        @Transactional
        public String onboardApplicant(ApplicantDTO applicantDTO) {
                // Validate that the application stage exists
                ApplicationStage appStage = applicationStageRepository
                                .findById(java.util.UUID.fromString(applicantDTO.getApplicationStageId()))
                                .orElseThrow(() -> new VacademyException("Application Stage not found"));

                // Create Applicant
                // Helper: Generate a random tracking ID for now (Placeholder for Auth User ID)
                String temporaryTrackingId = java.util.UUID.randomUUID().toString();

                Applicant applicant = Applicant.builder()
                                .trackingId(temporaryTrackingId)
                                .applicationStageId(applicantDTO.getApplicationStageId())
                                .applicationStageStatus(applicantDTO.getApplicationStageStatus())
                                .overallStatus(applicantDTO.getOverallStatus())
                                .build();

                Applicant savedApplicant = applicantRepository.save(applicant);

                // Create initial Applicant Stage entry
                // Note: For now we create one entry linked to the main stage.
                // In valid flow, there might be multiple steps (stages) derived from the main
                // config.
                ApplicantStage applicantStage = ApplicantStage.builder()
                                .applicantId(savedApplicant.getId().toString())
                                .stageId(appStage.getId().toString())
                                .stageStatus("INITIATED")
                                .build();

                applicantStageRepository.save(applicantStage);

                return savedApplicant.getId().toString();
        }

        /**
         * Get Applicants based on filters (institute, source, sourceId)
         */
        public Page<ApplicantDTO> getApplicants(ApplicantFilterDTO filterDTO) {
                Pageable pageable = PageRequest.of(
                                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                                filterDTO.getSize() != null ? filterDTO.getSize() : 20,
                                Sort.by(Sort.Direction.DESC, "createdAt"));

                Page<Applicant> applicants = applicantRepository.findApplicantsWithFilters(
                                filterDTO.getInstituteId(),
                                filterDTO.getSource(),
                                filterDTO.getSourceId(),
                                filterDTO.getOverallStatus(),
                                filterDTO.getApplicationStageId(),
                                filterDTO.getPackageSessionId(),
                                pageable);

                // Batch fetch Application Stages to avoid N+1
                java.util.Set<String> stageConfigIds = applicants.stream()
                                .map(Applicant::getApplicationStageId)
                                .collect(java.util.stream.Collectors.toSet());

                java.util.Map<String, ApplicationStage> stageConfigMap = applicationStageRepository
                                .findAllById(stageConfigIds.stream().map(UUID::fromString).toList())
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                s -> s.getId().toString(),
                                                s -> s));

                // Batch fetch Audience Responses (snapshot of source & user link)
                List<String> applicantIds = applicants.stream().map(a -> a.getId().toString()).toList();
                Map<String, AudienceResponse> applicantToAudienceResponseMap = audienceResponseRepository
                                .findByApplicantIdIn(applicantIds)
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                AudienceResponse::getApplicantId,
                                                ar -> ar,
                                                (existing, replacement) -> existing)); // Handle potential duplicates
                                                                                       // safely

                // Extract Parent/User IDs from Audience Response
                Set<String> parentUserIds = applicantToAudienceResponseMap.values().stream()
                                .map(AudienceResponse::getUserId)
                                .filter(Objects::nonNull)
                                .collect(java.util.stream.Collectors.toSet());

                Map<String, Student> childUserToStudentMap = new HashMap<>();
                Map<String, UserDTO> parentUserMap = new HashMap<>(); // ID -> UserDTO
                Map<String, String> parentToChildIdMap = new HashMap<>(); // ParentID -> ChildID

                if (!parentUserIds.isEmpty()) {

                        try {
                                // 1. Fetch Parent & Child Links from Auth Service
                                List<ParentWithChildDTO> parentWithChildList = authService
                                                .getUsersWithChildren(new ArrayList<>(parentUserIds));

                                // 2. Separate Parents and Children
                                Set<String> childUserIds = new HashSet<>();

                                for (ParentWithChildDTO pc : parentWithChildList) {
                                        if (pc.getParent() != null) {
                                                parentUserMap.put(pc.getParent().getId(), pc.getParent());
                                                if (pc.getChild() != null) {
                                                        parentToChildIdMap.put(pc.getParent().getId(),
                                                                        pc.getChild().getId());
                                                        childUserIds.add(pc.getChild().getId());
                                                }
                                        }
                                }

                                // 3. Fetch Students using Child IDs
                                if (!childUserIds.isEmpty()) {
                                        childUserToStudentMap = instituteStudentRepository
                                                        .findByUserIdIn(new ArrayList<>(childUserIds))
                                                        .stream()
                                                        .collect(java.util.stream.Collectors.toMap(
                                                                        Student::getUserId,
                                                                        s -> s));
                                }

                        } catch (Exception e) {
                                logger.error("Failed to fetch users/children from auth service", e);
                        }
                }

                // Final Assembly
                Map<String, Student> finalChildUserToStudentMap = childUserToStudentMap;
                Map<String, UserDTO> finalParentUserMap = parentUserMap;
                Map<String, String> finalParentToChildIdMap = parentToChildIdMap;

                return applicants.map(applicant -> {
                        ApplicantDTO dto = new ApplicantDTO(applicant);

                        // Set Stage details
                        ApplicationStage stage = stageConfigMap.get(applicant.getApplicationStageId());
                        if (stage != null) {
                                dto.setSourceDetails(stage.getSource(), stage.getSourceId());
                        }

                        // Assemble Data Map
                        Map<String, Object> data = new HashMap<>();
                        AudienceResponse ar = applicantToAudienceResponseMap.get(applicant.getId().toString());

                        if (ar != null) {
                                // 1. Add Source Info
                                data.put("source_inputs", Map.of(
                                                "source_type", ar.getSourceType(),
                                                "source_id", ar.getSourceId() == null ? "" : ar.getSourceId()));

                                if (ar.getUserId() != null) {
                                        String parentUserId = ar.getUserId();

                                        // 2. Add Student Personal/Academic Details (via Child ID)
                                        String childUserId = finalParentToChildIdMap.get(parentUserId);
                                        if (childUserId != null) {
                                                Student student = finalChildUserToStudentMap.get(childUserId);
                                                if (student != null) {
                                                        // Add fields relevant for the application view
                                                        data.put("student_name", student.getFullName());
                                                        data.put("gender", student.getGender());
                                                        data.put("dob", student.getDateOfBirth());
                                                        data.put("father_name", student.getFatherName());
                                                        data.put("mother_name", student.getMotherName());
                                                        data.put("current_school", student.getPreviousSchoolName());
                                                        data.put("city", student.getCity());
                                                        data.put("address", student.getAddressLine());
                                                }
                                        }

                                        // 3. Add Parent User Contact Details (Phone/Email)
                                        UserDTO user = finalParentUserMap.get(parentUserId);
                                        if (user != null) {
                                                data.put("parent_name", user.getFullName()); // Parent Name
                                                data.put("mobile_number", user.getMobileNumber());
                                                data.put("email", user.getEmail());
                                        }
                                } else {
                                        // If no user linked yet, fall back to AudienceResponse snapshot data
                                        data.put("parent_name", ar.getParentName());
                                        data.put("mobile_number", ar.getParentMobile());
                                        data.put("email", ar.getParentEmail());
                                }
                        }

                        dto.setData(data);
                        return dto;
                });
        }

        /**
         * Get Application Stages based on filters
         */
        public java.util.List<ApplicationStageDTO> getApplicationStages(String instituteId, String source,
                        String sourceId) {
                return applicationStageRepository.findByFilters(instituteId, source, sourceId)
                                .stream()
                                .map(stage -> new ApplicationStageDTO(stage))
                                .collect(java.util.stream.Collectors.toList());
        }

        /**
         * Get enquiry details by enquiry ID for form pre-fill
         */
        public EnquiryDetailsResponseDTO getEnquiryDetailsByEnquiryId(String enquiryId) {
                AudienceResponse audienceResponse = audienceResponseRepository.findByEnquiryId(enquiryId)
                                .orElseThrow(() -> new VacademyException("No enquiry found for ID: " + enquiryId));

                return buildEnquiryDetailsResponse(audienceResponse);
        }

        /**
         * Get enquiry details by phone number for form pre-fill
         */
        public EnquiryDetailsResponseDTO getEnquiryDetailsByPhone(String phone) {
                AudienceResponse audienceResponse = audienceResponseRepository
                                .findFirstByParentMobileOrderByCreatedAtDesc(phone)
                                .orElseThrow(() -> new VacademyException("No enquiry found for phone: " + phone));

                return buildEnquiryDetailsResponse(audienceResponse);
        }

        /**
         * Get enquiry details by tracking ID for form pre-fill
         * Lookup flow: tracking_id -> enquiry -> enquiry_id -> existing logic
         */
        public EnquiryDetailsResponseDTO getEnquiryDetailsByTrackingId(String trackingId) {
                // Step 1: Find Enquiry by tracking ID
                vacademy.io.admin_core_service.features.enquiry.entity.Enquiry enquiry = enquiryRepository
                                .findByEnquiryTrackingId(trackingId)
                                .orElseThrow(() -> new VacademyException(
                                                "No enquiry found for tracking ID: " + trackingId));

                // Step 2: Reuse existing logic with enquiry ID
                return getEnquiryDetailsByEnquiryId(enquiry.getId().toString());
        }

        /**
         * Build EnquiryDetailsResponseDTO from AudienceResponse
         */
        private EnquiryDetailsResponseDTO buildEnquiryDetailsResponse(AudienceResponse audienceResponse) {
                EnquiryDetailsResponseDTO.ParentDetails parentDetails = EnquiryDetailsResponseDTO.ParentDetails
                                .builder()
                                .name(audienceResponse.getParentName())
                                .phone(audienceResponse.getParentMobile())
                                .email(audienceResponse.getParentEmail())
                                .build();

                EnquiryDetailsResponseDTO.ChildDetails childDetails = null;

                // If user_id exists, fetch user details from auth-service
                if (audienceResponse.getUserId() != null) {
                        try {
                                List<ParentWithChildDTO> usersWithChildren = authService
                                                .getUsersWithChildren(List.of(audienceResponse.getUserId()));
                                if (!usersWithChildren.isEmpty()) {
                                        ParentWithChildDTO parentWithChild = usersWithChildren
                                                        .get(0);
                                        UserDTO parentUser = parentWithChild.getParent();
                                        UserDTO childUser = parentWithChild.getChild();

                                        if (parentUser != null) {
                                                parentDetails = EnquiryDetailsResponseDTO.ParentDetails.builder()
                                                                .id(parentUser.getId())
                                                                .name(parentUser.getFullName())
                                                                .phone(parentUser.getMobileNumber())
                                                                .email(parentUser.getEmail())
                                                                .addressLine(parentUser.getAddressLine())
                                                                .city(parentUser.getCity())
                                                                .pinCode(parentUser.getPinCode())
                                                                .build();
                                        }

                                        if (childUser != null) {
                                                childDetails = EnquiryDetailsResponseDTO.ChildDetails.builder()
                                                                .id(childUser.getId())
                                                                .name(childUser.getFullName())
                                                                .dob(childUser.getDateOfBirth())
                                                                .gender(childUser.getGender())
                                                                .build();
                                        }
                                }
                        } catch (Exception e) {
                                // Continue with audience_response data if auth-service call fails
                        }
                }

                // Get tracking ID from enquiry if available
                String trackingId = null;
                if (audienceResponse.getEnquiryId() != null) {
                        Optional<Enquiry> enquiry = enquiryRepository.findById(
                                        UUID.fromString(audienceResponse.getEnquiryId()));
                        if (enquiry.isPresent()) {
                                trackingId = enquiry.get().getEnquiryTrackingId();
                        }
                }

                return EnquiryDetailsResponseDTO.builder()
                                .enquiryId(audienceResponse.getEnquiryId())
                                .trackingId(trackingId)
                                .alreadyApplied(audienceResponse.getApplicantId() != null)
                                .applicantId(audienceResponse.getApplicantId())
                                .parent(parentDetails)
                                .child(childDetails)
                                .build();
        }

        /**
         * Submit application - handles both linked (from enquiry) and direct (manual)
         * applications
         */
        @Transactional
        public ApplyResponseDTO submitApplication(ApplyRequestDTO request) {
                // Validate required fields
                if (request.getInstituteId() == null || request.getSource() == null || request.getSourceId() == null) {
                        throw new VacademyException("institute_id, source, and source_id are required");
                }

                // Find the first application stage for this workflow
                List<ApplicationStage> stages = applicationStageRepository.findByFilters(
                                request.getInstituteId(), request.getSource(), request.getSourceId());

                if (stages.isEmpty()) {
                        throw new VacademyException("No application stage found for the given configuration");
                }

                // Get first stage (minimum sequence)
                ApplicationStage firstStage = stages.stream()
                                .min((s1, s2) -> Integer.compare(
                                                s1.getSequence() != null ? Integer.parseInt(s1.getSequence()) : 0,
                                                s2.getSequence() != null ? Integer.parseInt(s2.getSequence()) : 0))
                                .orElse(stages.get(0));

                String enquiryId = request.getEnquiryId();
                String trackingId = generateCustomTrackingId(); // Generate NEW independent ID
                AudienceResponse audienceResponse = null;

                if (enquiryId != null) {
                        // === Path 1: Pre-filled from Enquiry ===
                        audienceResponse = audienceResponseRepository.findByEnquiryId(enquiryId)
                                        .orElseThrow(() -> new VacademyException(
                                                        "No enquiry found for ID: " + enquiryId));

                        // Check if already applied
                        if (audienceResponse.getApplicantId() != null) {
                                throw new VacademyException("Application already submitted for this enquiry");
                        }

                        // Sync/Create Student record using existing User ID
                        if (audienceResponse.getUserId() != null) {
                                // Fetch child user details to populate student
                                List<ParentWithChildDTO> users = authService
                                                .getUsersWithChildren(List.of(audienceResponse.getUserId()));
                                if (!users.isEmpty() && users.get(0).getChild() != null) {
                                        UserDTO childUser = users.get(0).getChild();
                                        createStudentProfile(childUser, request.getFormData(),
                                                        request.getCustomFieldValues(),
                                                        request.getInstituteId());
                                }
                        }

                } else {
                        // === Path 2: Manual / Direct Application ===

                        // 1. Find Audience by Session (or default)
                        if (request.getSessionId() == null) {
                                throw new VacademyException("session_id is required for manual application");
                        }

                        Audience audience = audienceRepository
                                        .findByInstituteIdAndSessionId(request.getInstituteId(), request.getSessionId())
                                        .orElseThrow(() -> new VacademyException(
                                                        "No audience campaign found for this session. Please contact admin."));

                        // 2. Create Users (Parent & Child)
                        UserDTO parentUser = createParentUser(request);
                        UserDTO childUser = createChildUser(request, parentUser.getId());

                        // 3. Create Student
                        if (childUser != null) {
                                createStudentProfile(childUser, request.getFormData(), request.getCustomFieldValues(),
                                                request.getInstituteId());
                        }

                        // 4. Create Audience Response (New record)
                        audienceResponse = AudienceResponse.builder()
                                        .audienceId(audience.getId())
                                        .userId(parentUser.getId())
                                        .sourceType("DIRECT_APPLICATION")
                                        .sourceId(request.getSourceId())
                                        .enquiryId(null) // Skip Enquiry
                                        .parentName(getFormDataString(request.getFormData(), "parent_name"))
                                        .parentEmail(getFormDataString(request.getFormData(), "parent_email"))
                                        .parentMobile(getFormDataString(request.getFormData(), "parent_phone"))
                                        .build();
                        audienceResponse = audienceResponseRepository.save(audienceResponse);
                }

                // === Common Path: Create Applicant & Link ===

                // Create applicant
                Applicant applicant = Applicant.builder()
                                .trackingId(trackingId)
                                .applicationStageId(firstStage.getId().toString())
                                .applicationStageStatus("INITIATED")
                                .overallStatus("PENDING")
                                .build();
                Applicant savedApplicant = applicantRepository.save(applicant);

                // Create applicant_stage with form data
                String responseJson = null;
                try {
                        responseJson = objectMapper.writeValueAsString(request.getFormData());
                } catch (JsonProcessingException e) {
                        responseJson = "{}";
                }

                ApplicantStage applicantStage = ApplicantStage.builder()
                                .applicantId(savedApplicant.getId().toString())
                                .stageId(firstStage.getId().toString())
                                .stageStatus("INITIATED")
                                .responseJson(responseJson)
                                .build();
                applicantStageRepository.save(applicantStage);

                // Update audience_response with applicant_id and destination_package_session_id
                // if provided
                audienceResponse.setApplicantId(savedApplicant.getId().toString());
                if (request.getDestinationPackageSessionId() != null) {
                        audienceResponse.setDestinationPackageSessionId(request.getDestinationPackageSessionId());
                }
                audienceResponseRepository.save(audienceResponse);

                return ApplyResponseDTO.builder()
                                .applicantId(savedApplicant.getId().toString())
                                .trackingId(trackingId)
                                .currentStage(firstStage.getStageName())
                                .status("INITIATED")
                                .message("Application submitted successfully")
                                .build();
        }

        /**
         * Create Student profile from Form Data
         * THROWS exception if student already exists for this user.
         */
        private void createStudentProfile(UserDTO childUser, java.util.Map<String, Object> formData,
                        Map<String, String> customFieldValues,
                        String instituteId) {
                try {
                        Optional<Student> existingStudent = instituteStudentRepository
                                        .findTopByUserId(childUser.getId());

                        if (existingStudent.isPresent()) {
                                throw new VacademyException(
                                                "Student profile already exists for this user. Cannot overwrite.");
                        }

                        Student student = new Student(childUser); // Initialize from UserDTO
                        student.setLinkedInstituteName("Vacademy"); // Placeholder or fetch actual

                        // --- Standard Fields ---
                        student.setAddressLine(getFormDataString(formData, "address_line"));
                        student.setCity(getFormDataString(formData, "city"));
                        student.setPinCode(getFormDataString(formData, "pin_code"));
                        student.setFatherName(getFormDataString(formData, "father_name"));
                        student.setMotherName(getFormDataString(formData, "mother_name"));

                        // --- New Fields (V96) ---
                        student.setIdNumber(getFormDataString(formData, "id_number"));
                        student.setIdType(getFormDataString(formData, "id_type"));

                        student.setPreviousSchoolName(getFormDataString(formData, "previous_school_name"));
                        student.setPreviousSchoolBoard(getFormDataString(formData, "previous_school_board"));
                        student.setLastClassAttended(getFormDataString(formData, "last_class_attended"));
                        student.setLastExamResult(getFormDataString(formData, "last_exam_result"));
                        student.setSubjectsStudied(getFormDataString(formData, "subjects_studied"));

                        student.setApplyingForClass(getFormDataString(formData, "applying_for_class"));
                        student.setAcademicYear(getFormDataString(formData, "academic_year"));
                        student.setBoardPreference(getFormDataString(formData, "board_preference"));

                        student.setTcNumber(getFormDataString(formData, "tc_number"));
                        student.setTcPending(getFormDataBoolean(formData, "tc_pending"));
                        student.setTcIssueDate(getFormDataDate(formData, "tc_issue_date"));

                        student.setHasSpecialEducationNeeds(
                                        getFormDataBoolean(formData, "has_special_education_needs"));
                        student.setIsPhysicallyChallenged(getFormDataBoolean(formData, "is_physically_challenged"));
                        student.setMedicalConditions(getFormDataString(formData, "medical_conditions"));
                        student.setDietaryRestrictions(getFormDataString(formData, "dietary_restrictions"));

                        student.setBloodGroup(getFormDataString(formData, "blood_group"));
                        student.setMotherTongue(getFormDataString(formData, "mother_tongue"));
                        student.setLanguagesKnown(getFormDataString(formData, "languages_known"));
                        student.setCategory(getFormDataString(formData, "category"));
                        student.setNationality(getFormDataString(formData, "nationality"));

                        Student savedStudent = instituteStudentRepository.save(student);

                        // Save custom fields (from explicit custom_field_values map)
                        saveCustomFieldValues(customFieldValues, savedStudent.getId(), instituteId);

                } catch (VacademyException ve) {
                        throw ve;
                } catch (Exception e) {
                        throw new RuntimeException("Failed to create student record: " + e.getMessage());
                }
        }

        /**
         * Save custom field values for non-standard form fields.
         * Loops through form_data, skips standard fields, and saves the rest to
         * custom_field_values.
         */
        /**
         * Save custom field values from explicit ID-based map.
         * Validates that field ID is linked to the institute before saving.
         */
        private void saveCustomFieldValues(Map<String, String> customFieldValues, String studentId,
                        String instituteId) {
                if (customFieldValues == null || customFieldValues.isEmpty()) {
                        return;
                }

                List<CustomFieldValues> customFieldValuesList = new ArrayList<>();

                for (Map.Entry<String, String> entry : customFieldValues.entrySet()) {
                        String customFieldId = entry.getKey();
                        String value = entry.getValue();

                        // Skip empty values
                        if (value == null || value.trim().isEmpty()) {
                                continue;
                        }

                        // Validate: Is this custom field linked to this institute?
                        boolean isLinked = instituteCustomFieldRepository
                                        .existsByInstituteIdAndCustomFieldIdAndStatus(instituteId, customFieldId,
                                                        "ACTIVE");

                        if (!isLinked) {
                                logger.warn("Security/Data Check: Custom field {} is not linked to institute {}. Skipping.",
                                                customFieldId, instituteId);
                                continue;
                        }

                        // Build CustomFieldValues entity (Directly using ID)
                        CustomFieldValues cfValue = CustomFieldValues.builder()
                                        .customFieldId(customFieldId)
                                        .sourceType("STUDENT")
                                        .sourceId(studentId)
                                        .value(value)
                                        .build();

                        customFieldValuesList.add(cfValue);
                }

                if (!customFieldValuesList.isEmpty()) {
                        customFieldValuesRepository.saveAll(customFieldValuesList);
                        logger.info("Saved {} custom field values for student {}", customFieldValuesList.size(),
                                        studentId);
                }
        }

        private Boolean getFormDataBoolean(java.util.Map<String, Object> formData, String key) {
                if (formData == null || !formData.containsKey(key))
                        return false;
                Object val = formData.get(key);
                if (val instanceof Boolean)
                        return (Boolean) val;
                if (val instanceof String)
                        return Boolean.parseBoolean((String) val);
                return false;
        }

        private java.util.Date getFormDataDate(java.util.Map<String, Object> formData, String key) {
                if (formData == null || !formData.containsKey(key))
                        return null;
                Object val = formData.get(key);
                if (val == null)
                        return null;

                try {
                        if (val instanceof String) {
                                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
                                return sdf.parse((String) val);
                        }
                } catch (Exception e) {
                        // Return null if parsing fails
                }
                return null;
        }

        /**
         * Generate a 5-character alphanumeric tracking ID
         */
        private String generateCustomTrackingId() {
                String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                StringBuilder sb = new StringBuilder();
                Random random = new Random();
                for (int i = 0; i < 5; i++) {
                        sb.append(chars.charAt(random.nextInt(chars.length())));
                }
                return sb.toString();
        }

        /**
         * Create parent user in auth-service
         */
        private UserDTO createParentUser(ApplyRequestDTO request) {
                UserDTO parentDTO = UserDTO.builder()
                                .fullName(getFormDataString(request.getFormData(), "parent_name"))
                                .mobileNumber(getFormDataString(request.getFormData(), "parent_phone"))
                                .email(getFormDataString(request.getFormData(), "parent_email"))
                                .isParent(true)
                                .roles(List.of("PARENT"))
                                .build();

                return authService.createUserFromAuthService(parentDTO, request.getInstituteId(), false);
        }

        /**
         * Create child user in auth-service linked to parent
         */
        private UserDTO createChildUser(ApplyRequestDTO request, String parentId) {
                String childName = getFormDataString(request.getFormData(), "child_name");
                if (childName == null || childName.isEmpty()) {
                        return null;
                }

                UserDTO childDTO = UserDTO.builder()
                                .fullName(childName)
                                .gender(getFormDataString(request.getFormData(), "child_gender"))
                                .isParent(false)
                                .linkedParentId(parentId)
                                .roles(List.of("STUDENT"))
                                .build();

                // Generate dummy email for child if not provided
                String dummyEmail = "child_" + System.currentTimeMillis() + "@vacademy.io";
                childDTO.setEmail(dummyEmail);

                // Handle date of birth
                Object dobValue = request.getFormData().get("child_dob");
                if (dobValue != null) {
                        try {
                                if (dobValue instanceof String) {
                                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd");
                                        childDTO.setDateOfBirth(sdf.parse((String) dobValue));
                                }
                        } catch (Exception e) {
                                // Ignore date parsing errors
                        }
                }

                return authService.createUserFromAuthService(childDTO, request.getInstituteId(), false);
        }

        /**
         * Helper to get string value from form data map
         */
        private String getFormDataString(java.util.Map<String, Object> formData, String key) {
                if (formData == null || !formData.containsKey(key)) {
                        return null;
                }
                Object value = formData.get(key);
                return value != null ? value.toString() : null;
        }
}
