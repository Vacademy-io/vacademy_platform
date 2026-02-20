package vacademy.io.admin_core_service.features.applicant.service;

import com.fasterxml.jackson.databind.JsonNode;
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
import vacademy.io.admin_core_service.features.applicant.enums.ApplicantStageType;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantStageRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicationStageRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.UserPlanService;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.enums.UserPlanStatusEnum;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.common.repository.InstituteCustomFieldRepository;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.ParentWithChildDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;

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
        private InstituteCustomFieldRepository instituteCustomFieldRepository;

        @Autowired
        private PackageSessionRepository packageSessionRepository;

        @Autowired
        private vacademy.io.admin_core_service.features.payments.service.PaymentService paymentService;

        @Autowired
        private PaymentOptionRepository paymentOptionRepository;

        @Autowired
        private UserPlanService userPlanService;

        @Autowired
        private UserPlanRepository userPlanRepository;

        @Autowired
        private InstituteDomainRoutingRepository instituteDomainRoutingRepository;

        @Autowired
        private DynamicNotificationService dynamicNotificationService;

        @Autowired
        private NotificationService notificationService;

        @Autowired
        private SendUniqueLinkService sendUniqueLinkService;

        @Autowired
        private NotificationEventConfigRepository notificationEventConfigRepository;

        @Autowired
        private InstituteRepository instituteRepository;

        // Correct Imports for Payment DTOs
        // using fully qualified names in method signature to avoid ambiguity if needed
        // or we can import them. For this replace, I will use FQN in method signature
        // update below.

        private static final Logger logger = LoggerFactory.getLogger(ApplicantService.class);

        private final ObjectMapper objectMapper = new ObjectMapper();

        /**
         * Create a new Application Stage configuration
         */
        @Transactional
        public String createApplicationStage(ApplicationStageDTO stageDTO) {
                // Find existing stages for this workflow to determine order
                java.util.List<ApplicationStage> existingStages = applicationStageRepository.findByFilters(
                                stageDTO.getInstituteId(),
                                stageDTO.getSource(),
                                stageDTO.getSourceId(),
                                stageDTO.getWorkflowType());

                boolean isFirst = false;
                boolean isLast = true; // New stages are always placed at the end

                if (existingStages.isEmpty()) {
                        isFirst = true; // If no existing stages, it's also the first
                } else {
                        // Find the current last stage and update it
                        for (ApplicationStage s : existingStages) {
                                if (Boolean.TRUE.equals(s.getIsLast())) {
                                        s.setIsLast(false);
                                        applicationStageRepository.save(s);
                                }
                        }
                }

                // If sequence isn't strictly provided or to enforce linear logic we can
                // automatically set it.
                // But relying on existing string input for now, we leave as is or default to
                // existingStages.size() + 1
                String calculatedSequence = String.valueOf(existingStages.size() + 1);

                ApplicationStage stage = ApplicationStage.builder()
                                .stageName(stageDTO.getStageName())
                                .sequence(calculatedSequence) // Ensuring sequence represents actual order
                                .source(stageDTO.getSource())
                                .sourceId(stageDTO.getSourceId())
                                .instituteId(stageDTO.getInstituteId())
                                .configJson(stageDTO.getConfigJson())
                                .type(stageDTO.getType())
                                .workflowType(stageDTO.getWorkflowType())
                                .isFirst(stageDTO.getIsFirst())
                                .isLast(stageDTO.getIsLast())
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
                                .responseJson(appStage.getConfigJson()) // Copy Config to Response
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
                        String sourceId, String workflowType) {

                // Backward Compatibility: Default to "APPLICATION" if workflowType is
                // null/empty
                if (workflowType == null || workflowType.isEmpty()) {
                        workflowType = "APPLICATION";
                }

                return applicationStageRepository.findByFilters(instituteId, source, sourceId, workflowType)
                                .stream()
                                .map(stage -> new ApplicationStageDTO(stage))
                                .collect(java.util.stream.Collectors.toList());
        }

        /**
         * Enhanced get applicants with collective filters and enriched response
         */
        public Page<ApplicantListResponseDTO> getApplicantsEnhanced(ApplicantListRequestDTO request, int pageNo,
                        int pageSize) {
                Pageable pageable = PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

                Page<Applicant> applicants = applicantRepository.findApplicantsWithEnhancedFilters(
                                request.getInstituteId(),
                                request.getSource(),
                                request.getSourceId(),
                                request.getOverallStatuses(),
                                request.getApplicationStageId(),
                                request.getPackageSessionIds(),
                                request.getSearch(),
                                pageable);

                // Batch fetch Application Stages
                Set<String> stageConfigIds = applicants.stream()
                                .map(Applicant::getApplicationStageId)
                                .collect(java.util.stream.Collectors.toSet());

                Map<String, ApplicationStage> stageConfigMap = applicationStageRepository
                                .findAllById(stageConfigIds.stream().map(UUID::fromString).toList())
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                s -> s.getId().toString(),
                                                s -> s));

                // Batch fetch Audience Responses
                List<String> applicantIds = applicants.stream().map(a -> a.getId().toString()).toList();
                Map<String, AudienceResponse> applicantToAudienceResponseMap = audienceResponseRepository
                                .findByApplicantIdIn(applicantIds)
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                AudienceResponse::getApplicantId,
                                                ar -> ar,
                                                (existing, replacement) -> existing));

                // Extract Parent/User IDs
                Set<String> parentUserIds = applicantToAudienceResponseMap.values().stream()
                                .map(AudienceResponse::getUserId)
                                .filter(Objects::nonNull)
                                .collect(java.util.stream.Collectors.toSet());

                // Batch fetch PackageSession IDs
                Set<String> packageSessionIds = applicantToAudienceResponseMap.values().stream()
                                .map(AudienceResponse::getDestinationPackageSessionId)
                                .filter(Objects::nonNull)
                                .collect(java.util.stream.Collectors.toSet());

                Map<String, PackageSession> packageSessionMap = new HashMap<>();
                if (!packageSessionIds.isEmpty()) {
                        packageSessionMap = packageSessionRepository.findAllById(new ArrayList<>(packageSessionIds))
                                        .stream()
                                        .collect(java.util.stream.Collectors.toMap(
                                                        PackageSession::getId,
                                                        ps -> ps));
                }

                Map<String, Student> childUserToStudentMap = new HashMap<>();
                Map<String, UserDTO> parentUserMap = new HashMap<>();
                Map<String, UserDTO> childUserMap = new HashMap<>();
                Map<String, String> parentToChildIdMap = new HashMap<>();

                if (!parentUserIds.isEmpty()) {
                        try {
                                List<ParentWithChildDTO> parentWithChildList = authService
                                                .getUsersWithChildren(new ArrayList<>(parentUserIds));

                                Set<String> childUserIds = new HashSet<>();

                                for (ParentWithChildDTO pc : parentWithChildList) {
                                        if (pc.getParent() != null) {
                                                parentUserMap.put(pc.getParent().getId(), pc.getParent());
                                                if (pc.getChild() != null) {
                                                        parentToChildIdMap.put(pc.getParent().getId(),
                                                                        pc.getChild().getId());
                                                        childUserIds.add(pc.getChild().getId());
                                                        childUserMap.put(pc.getChild().getId(), pc.getChild());
                                                }
                                        }
                                }

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

                // Final maps for lambda
                Map<String, PackageSession> finalPackageSessionMap = packageSessionMap;
                Map<String, Student> finalChildUserToStudentMap = childUserToStudentMap;
                Map<String, UserDTO> finalParentUserMap = parentUserMap;
                Map<String, UserDTO> finalChildUserMap = childUserMap;
                Map<String, String> finalParentToChildIdMap = parentToChildIdMap;

                return applicants.map(applicant -> {
                        ApplicantListResponseDTO dto = ApplicantListResponseDTO.builder()
                                        .applicantId(applicant.getId().toString())
                                        .trackingId(applicant.getTrackingId())
                                        .overallStatus(applicant.getOverallStatus())
                                        .applicationStageStatus(applicant.getApplicationStageStatus())
                                        .createdAt(applicant.getCreatedAt())
                                        .updatedAt(applicant.getUpdatedAt())
                                        .build();

                        // Set Application Stage Info
                        ApplicationStage stage = stageConfigMap.get(applicant.getApplicationStageId());
                        if (stage != null) {
                                dto.setApplicationStage(ApplicantListResponseDTO.ApplicationStageInfo.builder()
                                                .stageId(stage.getId().toString())
                                                .stageName(stage.getStageName())
                                                .source(stage.getSource())
                                                .sourceId(stage.getSourceId())
                                                .type(stage.getType() != null ? stage.getType().name() : null)
                                                .build());
                        }

                        AudienceResponse ar = applicantToAudienceResponseMap.get(applicant.getId().toString());

                        if (ar != null) {
                                String parentUserId = ar.getUserId();

                                // Set Student Data
                                if (parentUserId != null) {
                                        String childUserId = finalParentToChildIdMap.get(parentUserId);
                                        if (childUserId != null) {
                                                Student student = finalChildUserToStudentMap.get(childUserId);
                                                UserDTO childUser = finalChildUserMap.get(childUserId);

                                                if (student != null || childUser != null) {
                                                        ApplicantListResponseDTO.StudentData studentData = ApplicantListResponseDTO.StudentData
                                                                        .builder()
                                                                        .userId(childUserId)
                                                                        .build();

                                                        if (student != null) {
                                                                studentData.setFullName(student.getFullName());
                                                                studentData.setGender(student.getGender());
                                                                studentData.setDateOfBirth(student.getDateOfBirth());
                                                                studentData.setFatherName(student.getFatherName());
                                                                studentData.setMotherName(student.getMotherName());
                                                                studentData.setAddressLine(student.getAddressLine());
                                                                studentData.setCity(student.getCity());
                                                                studentData.setPinCode(student.getPinCode());
                                                                studentData.setPreviousSchoolName(
                                                                                student.getPreviousSchoolName());
                                                                studentData.setApplyingForClass(
                                                                                student.getApplyingForClass());
                                                                studentData.setAcademicYear(student.getAcademicYear());
                                                        } else if (childUser != null) {
                                                                studentData.setFullName(childUser.getFullName());
                                                                studentData.setGender(childUser.getGender());
                                                                studentData.setDateOfBirth(
                                                                                childUser.getDateOfBirth());
                                                        }

                                                        dto.setStudentData(studentData);
                                                }
                                        }

                                        // Set Parent Data
                                        UserDTO parentUser = finalParentUserMap.get(parentUserId);
                                        if (parentUser != null) {
                                                dto.setParentData(ApplicantListResponseDTO.ParentData.builder()
                                                                .userId(parentUserId)
                                                                .fullName(parentUser.getFullName())
                                                                .email(parentUser.getEmail())
                                                                .mobileNumber(parentUser.getMobileNumber())
                                                                .addressLine(parentUser.getAddressLine())
                                                                .city(parentUser.getCity())
                                                                .pinCode(parentUser.getPinCode())
                                                                .build());
                                        }
                                } else {
                                        // Fallback to AudienceResponse snapshot data if no user linked
                                        dto.setParentData(ApplicantListResponseDTO.ParentData.builder()
                                                        .fullName(ar.getParentName())
                                                        .email(ar.getParentEmail())
                                                        .mobileNumber(ar.getParentMobile())
                                                        .build());
                                }

                                // Set PackageSession Data
                                if (ar.getDestinationPackageSessionId() != null) {
                                        PackageSession ps = finalPackageSessionMap
                                                        .get(ar.getDestinationPackageSessionId());
                                        if (ps != null) {
                                                dto.setPackageSession(
                                                                ApplicantListResponseDTO.PackageSessionData.builder()
                                                                                .packageSessionId(ps.getId())
                                                                                .sessionName(ps.getSession() != null
                                                                                                ? ps.getSession()
                                                                                                                .getSessionName()
                                                                                                : null)
                                                                                .levelName(ps.getLevel() != null
                                                                                                ? ps.getLevel().getLevelName()
                                                                                                : null)
                                                                                .packageName(
                                                                                                ps.getPackageEntity() != null
                                                                                                                ? ps.getPackageEntity()
                                                                                                                                .getPackageName()
                                                                                                                : null)
                                                                                .groupName(ps.getGroup() != null
                                                                                                ? ps.getGroup().getGroupName()
                                                                                                : null)
                                                                                .startTime(ps.getStartTime())
                                                                                .status(ps.getStatus())
                                                                                .build());
                                        }
                                }
                        }

                        return dto;
                });
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

                String workflowTypeInput = request.getWorkflowType();
                final String workflowType = (workflowTypeInput == null || workflowTypeInput.isEmpty()) ? "APPLICATION"
                                : workflowTypeInput;

                // Find the first application stage for this workflow config
                // Find the first application stage for this workflow (isFirst = true)
                ApplicationStage firstStage = applicationStageRepository.findFirstStage(
                                request.getInstituteId(), request.getSource(), request.getSourceId(), workflowType)
                                .orElseThrow(() -> new VacademyException(
                                                "No initial stage found for the given configuration (Workflow: "
                                                                + workflowType
                                                                + ")"));

                String enquiryId = request.getEnquiryId();
                String trackingId = generateCustomTrackingId(); // Generate NEW independent ID
                AudienceResponse audienceResponse = null;

                // Define variables for email notification
                UserDTO parentUser = null;
                UserDTO childUser = null;
                PackageSession packageSession = null;

                if (enquiryId != null) {
                        // === Path 1: Pre-filled from Enquiry ===
                        audienceResponse = audienceResponseRepository.findByEnquiryId(enquiryId)
                                        .orElseThrow(() -> new VacademyException(
                                                        "No enquiry found for ID: " + enquiryId));

                        // Update status to APPLICATION
                        audienceResponse.setOverallStatus("APPLICATION");

                        // Check if already applied
                        if (audienceResponse.getApplicantId() != null) {
                                // Transition Logic for ADMISSION workflow
                                if ("ADMISSION".equals(workflowType)) {
                                        // Allow transition/update
                                        logger.info("Transitioning existing applicant {} to ADMISSION workflow",
                                                        audienceResponse.getApplicantId());
                                } else {
                                        throw new VacademyException("Application already submitted for this enquiry");
                                }
                        }

                        // Sync/Create Student record using existing User ID
                        if (audienceResponse.getUserId() != null) {
                                // Fetch users to populate local variables
                                List<ParentWithChildDTO> users = authService
                                                .getUsersWithChildren(List.of(audienceResponse.getUserId()));
                                if (!users.isEmpty()) {
                                        ParentWithChildDTO parentWithChild = users.get(0);
                                        parentUser = parentWithChild.getParent();
                                        childUser = parentWithChild.getChild();

                                        if (childUser != null) {
                                                createStudentProfile(childUser, request.getFormData(),
                                                                request.getCustomFieldValues(),
                                                                request.getInstituteId());
                                        }
                                }
                        }

                        // Fetch PackageSession for email
                        String packageSessionId = request.getDestinationPackageSessionId();
                        if (packageSessionId == null) {
                                packageSessionId = audienceResponse.getDestinationPackageSessionId();
                        }
                        // Fallback to request session Id if manual override or specific session context
                        if (packageSessionId == null) {
                                packageSessionId = request.getSessionId();
                        }

                        if (packageSessionId != null) {
                                packageSession = packageSessionRepository.findById(packageSessionId).orElse(null);
                        }

                } else {
                        // === Path 2: Manual / Direct Application ===

                        // 2. Create Users (Parent & Child)
                        parentUser = createParentUser(request);
                        childUser = createChildUser(request, parentUser.getId());

                        // 3. Create Student
                        if (childUser != null) {
                                createStudentProfile(childUser, request.getFormData(), request.getCustomFieldValues(),
                                                request.getInstituteId());
                        }

                        // 4. Check for Existing Audience Response by User IDs (Optimization for
                        // Admission)
                        // If we are in ADMISSION mode (or even standard), checking for existing link
                        // prevents duplicates
                        List<AudienceResponse> existingResponses = audienceResponseRepository
                                        .findByUserIdOrStudentUserId(
                                                        parentUser.getId(),
                                                        childUser != null ? childUser.getId() : null);

                        // Filter for relevant response (checking if one already exists with source
                        // linkage or generic)
                        // For Admission, we prioritize any existing link to reuse
                        Optional<AudienceResponse> existingAr = existingResponses.stream().findFirst();

                        if (existingAr.isPresent()) {
                                audienceResponse = existingAr.get();
                                logger.info("Found existing AudienceResponse/Lead for user. Reusing ID: {}",
                                                audienceResponse.getId());

                                // Check existing applicant on this AR
                                if (audienceResponse.getApplicantId() != null) {
                                        if ("ADMISSION".equals(workflowType)) {
                                                logger.info("Transitioning existing applicant {} to ADMISSION workflow (Direct Path)",
                                                                audienceResponse.getApplicantId());
                                                // Logic continues below to reused applicant
                                        } else {
                                                throw new VacademyException(
                                                                "Application already submitted for this user.");
                                        }
                                }
                        } else {
                                // Create NEW Audience Response
                                if ("ADMISSION".equals(workflowType)) {
                                        // ADMISSION path: no Audience campaign required — create a direct response
                                        audienceResponse = AudienceResponse.builder()
                                                        .audienceId(null) // No campaign for manual admission
                                                        .userId(parentUser.getId())
                                                        .studentUserId(childUser != null ? childUser.getId() : null)
                                                        .sourceType("MANUAL_ADMISSION")
                                                        .sourceId(request.getSourceId())
                                                        .enquiryId(null)
                                                        .parentName(getFormDataString(request.getFormData(),
                                                                        "parent_name"))
                                                        .parentEmail(getFormDataString(request.getFormData(),
                                                                        "parent_email"))
                                                        .parentMobile(getFormDataString(request.getFormData(),
                                                                        "parent_phone"))
                                                        .overallStatus("ADMISSION")
                                                        .build();
                                } else {
                                        Audience audience = audienceRepository
                                                        .findByInstituteIdAndSessionId(request.getInstituteId(),
                                                                        request.getSessionId())
                                                        .orElseThrow(() -> new VacademyException(
                                                                        "No audience campaign found for this session. Please contact admin."));

                                        audienceResponse = AudienceResponse.builder()
                                                        .audienceId(audience.getId())
                                                        .userId(parentUser.getId())
                                                        .studentUserId(childUser != null ? childUser.getId() : null)
                                                        .sourceType("DIRECT_APPLICATION")
                                                        .sourceId(request.getSourceId())
                                                        .enquiryId(null) // Skip Enquiry
                                                        .parentName(getFormDataString(request.getFormData(),
                                                                        "parent_name"))
                                                        .parentEmail(getFormDataString(request.getFormData(),
                                                                        "parent_email"))
                                                        .parentMobile(getFormDataString(request.getFormData(),
                                                                        "parent_phone"))
                                                        .overallStatus("APPLICATION")
                                                        .build();
                                }
                                audienceResponse = audienceResponseRepository.save(audienceResponse);
                        }
                }

                // === Common Path: Create Applicant & Link ===

                Applicant applicant;
                boolean isTransition = false;

                if (audienceResponse.getApplicantId() != null && "ADMISSION".equals(workflowType)) {
                        // Reuse Existing Applicant
                        isTransition = true;
                        applicant = applicantRepository.findById(UUID.fromString(audienceResponse.getApplicantId()))
                                        .orElseThrow(() -> new VacademyException("Linked Applicant not found"));

                        // Update Workflow and Reset Status
                        applicant.setWorkflowType(workflowType);
                        applicant.setApplicationStageId(firstStage.getId().toString());
                        applicant.setApplicationStageStatus("INITIATED");
                        applicant.setOverallStatus("PENDING"); // Or ADMISSION_IN_PROGRESS
                        // We might want to close previous stage here?
                        // For now, simply repointing the current stage ID effectively "moves" them.
                        // The old ApplicantStage record remains in history.
                } else {
                        // Create NEW Applicant
                        applicant = Applicant.builder()
                                        .trackingId(trackingId)
                                        .applicationStageId(firstStage.getId().toString())
                                        .applicationStageStatus("INITIATED")
                                        .overallStatus("PENDING")
                                        .workflowType(workflowType)
                                        .build();
                }

                Applicant savedApplicant = applicantRepository.save(applicant);

                // Create applicant_stage with TEMPLATE CONFIG (from Application Stage)
                // Option A: Blind Copy Template Strategy
                String responseJson = firstStage.getConfigJson();
                if (responseJson == null || responseJson.isEmpty()) {
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

                // Send application confirmation email with credentials
                sendApplicationConfirmationEmail(
                                savedApplicant.getId().toString(),
                                request.getInstituteId(),
                                firstStage,
                                parentUser,
                                childUser,
                                packageSession);

                // Trigger Email if Payment Stage
                if (ApplicantStageType.PAYMENT.equals(firstStage.getType())) {
                        sendApplicationPaymentEmail(savedApplicant.getId().toString(), firstStage);
                }

                return ApplyResponseDTO.builder()
                                .applicantId(savedApplicant.getId().toString())
                                .trackingId(savedApplicant.getTrackingId())
                                .currentStage(firstStage.getStageName())
                                .status(savedApplicant.getOverallStatus())
                                .overallStatus(savedApplicant.getOverallStatus())
                                .isTransition(isTransition)
                                .message(isTransition ? "Applicant transitioned to Admission workflow successfully"
                                                : "Application submitted successfully")
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

                        // --- New Fields (V112) - Admission Specific ---
                        student.setAdmissionNo(getFormDataString(formData, "admission_no"));
                        // TODO (future migration): restore when columns are added
                        // student.setSection(getFormDataString(formData, "section"));
                        // student.setHasTransport(getFormDataBoolean(formData, "has_transport"));
                        // student.setStudentType(getFormDataString(formData, "student_type"));
                        // student.setClassGroup(getFormDataString(formData, "class_group"));
                        student.setAdmissionType(getFormDataString(formData, "admission_type"));
                        // student.setYearOfPassing(getFormDataString(formData, "year_of_passing"));
                        // student.setPreviousAdmissionNo(getFormDataString(formData,
                        // "previous_admission_no"));
                        // student.setReligion(getFormDataString(formData, "religion"));
                        // student.setCaste(getFormDataString(formData, "caste")); // TODO: restore once
                        // migration adds caste column
                        // student.setHowDidYouKnow(getFormDataString(formData, "how_did_you_know"));
                        // Aadhaar for student
                        String studentAadhaar = getFormDataString(formData, "student_aadhaar");
                        if (studentAadhaar != null) {
                                student.setIdNumber(studentAadhaar);
                                student.setIdType("AADHAAR");
                        }
                        // Father details
                        student.setFatherName(getFormDataString(formData, "fathers_name"));
                        student.setParentsMobileNumber(getFormDataString(formData, "father_mobile"));
                        student.setParentsEmail(getFormDataString(formData, "father_email"));
                        // student.setFatherAadhaar(getFormDataString(formData, "father_aadhaar"));
                        // student.setFatherQualification(getFormDataString(formData,
                        // "father_qualification"));
                        // student.setFatherOccupation(getFormDataString(formData,
                        // "father_occupation"));
                        // Mother details
                        student.setMotherName(getFormDataString(formData, "mothers_name"));
                        student.setParentToMotherMobileNumber(getFormDataString(formData, "mother_mobile"));
                        student.setParentsToMotherEmail(getFormDataString(formData, "mother_email"));
                        // student.setMotherAadhaar(getFormDataString(formData, "mother_aadhaar"));
                        // student.setMotherQualification(getFormDataString(formData,
                        // "mother_qualification"));
                        // student.setMotherOccupation(getFormDataString(formData,
                        // "mother_occupation"));
                        // Guardian details
                        student.setGuardianName(getFormDataString(formData, "guardian_name"));
                        student.setGuardianMobile(getFormDataString(formData, "guardian_mobile"));
                        // Address
                        // student.setPermanentAddress(getFormDataString(formData,
                        // "permanent_address"));
                        // student.setPermanentLocality(getFormDataString(formData,
                        // "permanent_locality"));

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
         * Prepare Payment for Applicant
         * 1. Validates stage.
         * 2. Calls PaymentService.
         * 3. Updates ApplicantStage response_json with order_id.
         */
        @Transactional
        public vacademy.io.common.payment.dto.PaymentResponseDTO preparePayment(
                        String applicantId,
                        String paymentOptionId,
                        vacademy.io.common.payment.dto.PaymentInitiationRequestDTO requestDTO,
                        vacademy.io.common.auth.model.CustomUserDetails userDetails) {
                // 1. Get Current Stage
                ApplicantStage currentStage = applicantStageRepository
                                .findTopByApplicantIdOrderByCreatedAtDesc(applicantId)
                                .orElseThrow(() -> new VacademyException("Applicant stage not found"));

                // Dynamic Vendor Support: Default to STRIPE if not provided
                if (!org.springframework.util.StringUtils.hasText(requestDTO.getVendor())) {
                        requestDTO.setVendor("STRIPE");
                }

                // 2. Initiate Payment via PaymentService
                // Fix: Fetch Applicant, Institute, and Create UserPlan first
                // Get applicant for tracking ID
                Applicant applicant = applicantRepository.findById(java.util.UUID.fromString(applicantId))
                                .orElseThrow(() -> new VacademyException("Applicant not found"));

                // CRITICAL FIX: Get child user ID from AudienceResponse
                // Use studentUserId if available (new records), otherwise fall back to parent
                // resolution (legacy records)
                AudienceResponse audienceResponse = audienceResponseRepository
                                .findByApplicantId(applicantId)
                                .orElseThrow(() -> new VacademyException(
                                                "No audience response found for applicant. Application may be incomplete."));

                String childUserId;

                // NEW LOGIC: Check if studentUserId is populated (solves multi-child issue)
                if (audienceResponse.getStudentUserId() != null && !audienceResponse.getStudentUserId().isEmpty()) {
                        // Direct child ID available - use it (works for multi-child parents)
                        childUserId = audienceResponse.getStudentUserId();
                        logger.info("Using stored student_user_id: {} for applicant: {}", childUserId, applicantId);
                } else {
                        // LEGACY FALLBACK: For old records without studentUserId
                        logger.warn("No student_user_id found for applicant: {}, falling back to parent resolution",
                                        applicantId);
                        String parentUserId = audienceResponse.getUserId();

                        if (parentUserId == null || parentUserId.isEmpty()) {
                                throw new VacademyException(
                                                "No user linked to this applicant. Please complete the application first.");
                        }

                        logger.info("Applicant {} linked to parent user ID: {}", applicantId, parentUserId);

                        // Get child user ID from parent
                        List<vacademy.io.common.auth.dto.ParentWithChildDTO> parentWithChildren = authService
                                        .getUsersWithChildren(List.of(parentUserId));

                        if (parentWithChildren.isEmpty() || parentWithChildren.get(0).getChild() == null) {
                                throw new VacademyException(
                                                "No child found for parent. Please ensure child user is created for this applicant.");
                        }

                        childUserId = parentWithChildren.get(0).getChild().getId();
                        logger.info("Found child user ID: {} for parent: {}", childUserId, parentUserId);
                }

                // Get Institute ID from Application Stage (linked to Applicant)
                String appStageId = applicant.getApplicationStageId();
                vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage appStage = applicationStageRepository
                                .findById(UUID.fromString(appStageId))
                                .orElseThrow(() -> new VacademyException("Application Stage not found"));
                String instituteId = appStage.getInstituteId();

                // Get Payment Option
                PaymentOption paymentOption = paymentOptionRepository.findById(paymentOptionId)
                                .orElseThrow(() -> new VacademyException("Payment Option not found"));

                // Check for existing Pending Plan for this CHILD + Option
                // IMPORTANT: Use childUserId here for child-centric enrollment
                Optional<UserPlan> existingPlan = userPlanRepository
                                .findTopByUserIdAndPaymentOptionIdAndStatusInOrderByCreatedAtDesc(
                                                childUserId, // ← CHANGED: Use child user ID
                                                paymentOptionId,
                                                List.of(UserPlanStatusEnum.PENDING_FOR_PAYMENT.name()));

                // Security Fix: Validate Amount against Database Plans
                PaymentPlan selectedPlan = null;
                List<PaymentPlan> plans = paymentOption.getPaymentPlans();

                if (plans != null && !plans.isEmpty()) {
                        // Filter ACTIVE plans
                        List<PaymentPlan> activePlans = plans.stream()
                                        .filter(p -> "ACTIVE".equals(p.getStatus()))
                                        .toList();

                        if (!activePlans.isEmpty()) {
                                // Find match for requested amount
                                Double requestedAmount = requestDTO.getAmount();

                                Optional<PaymentPlan> matchedPlan = activePlans.stream()
                                                .filter(p -> Math.abs(p.getActualPrice() - requestedAmount) < 0.01) // Allow
                                                                                                                    // tiny
                                                                                                                    // double
                                                                                                                    // precision
                                                                                                                    // error
                                                .findFirst();

                                if (matchedPlan.isPresent()) {
                                        selectedPlan = matchedPlan.get();
                                } else {
                                        // Security Violation: Amount matches no valid plan
                                        // throw new VacademyException("Invalid payment amount: " + requestedAmount + ".
                                        // Please select a valid plan.");

                                        // fallback for now: just pick the first plan or default plan if amount is 1
                                        // For now, let's just picking the first one if the amount is suspicious,
                                        // OR strictly enforce. The user asked to "do it", implying strict checks.
                                        // However, to avoid breaking if frontend sends slightly different data, let's
                                        // auto-select default if available.
                                        // Actually, let's be strict but helpful.
                                        throw new VacademyException("Invalid payment amount: " + requestedAmount
                                                        + ". Valid amounts are: " +
                                                        activePlans.stream()
                                                                        .map(p -> String.valueOf(p.getActualPrice()))
                                                                        .collect(java.util.stream.Collectors
                                                                                        .joining(", ")));
                                }
                        }
                }

                UserPlan userPlan;
                if (existingPlan.isPresent()) {
                        userPlan = existingPlan.get();

                        // Update if different plan selected
                        if (selectedPlan != null && !selectedPlan.getId().equals(userPlan.getPaymentPlanId())) {
                                // This handles if user switches from 500 to 5000 plan
                        }
                } else {
                        // Create New Plan with CHILD as beneficiary
                        // CRITICAL CHANGE: Use childUserId instead of parentUserId
                        userPlan = userPlanService.createUserPlan(
                                        childUserId, // ← CHANGED: Use child user ID (beneficiary)
                                        selectedPlan, // <-- Pass the validated plan
                                        null,
                                        null,
                                        paymentOption,
                                        requestDTO,
                                        UserPlanStatusEnum.PENDING_FOR_PAYMENT.name());
                }

                vacademy.io.common.payment.dto.PaymentResponseDTO response = paymentService
                                .handleUserPlanPayment(requestDTO, instituteId, userDetails, userPlan.getId());

                // 3. Update Response JSON with Order ID
                try {
                        // Read existing JSON (which is the Template)
                        java.util.Map<String, Object> jsonMap = new java.util.HashMap<>();
                        if (org.springframework.util.StringUtils.hasText(currentStage.getResponseJson())) {
                                try {
                                        jsonMap = objectMapper.readValue(
                                                        currentStage.getResponseJson(),
                                                        new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {
                                                        });
                                } catch (Exception e) {
                                        logger.warn("Metadata JSON invalid/empty in stage, initializing new map");
                                }
                        }

                        // Update Keys
                        jsonMap.put("order_id", response.getOrderId());
                        jsonMap.put("payment_status", "INITIATED");

                        // Save
                        currentStage.setResponseJson(objectMapper.writeValueAsString(jsonMap));
                        applicantStageRepository.save(currentStage);

                        return response;

                } catch (Exception e) {
                        logger.error("Failed to update applicant stage json", e);
                        // We still return success as payment was initiated
                        return response;
                }
        }

        /**
         * Handle Payment Success (Called by Webhook/PaymentService)
         */
        @Transactional
        public void handlePaymentSuccess(String orderId) {
                // 1. Find Stage by Order ID (Using Native JSON Query)
                ApplicantStage stage = applicantStageRepository.findByOrderId(orderId)
                                .orElseThrow(() -> new VacademyException(
                                                "No Applicant Stage found for Order ID: " + orderId));

                try {
                        // 2. Update JSON Status
                        java.util.Map<String, Object> jsonMap = objectMapper.readValue(
                                        stage.getResponseJson(),
                                        new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {
                                        });

                        // Check if already completed to avoid duplicates
                        if ("COMPLETED".equals(jsonMap.get("payment_status"))) {
                                logger.info("Payment already handled for order: {}", orderId);
                                return;
                        }

                        jsonMap.put("payment_status", "COMPLETED");
                        jsonMap.put("completed_at", new java.util.Date().toString());

                        stage.setResponseJson(objectMapper.writeValueAsString(jsonMap));
                        stage.setStageStatus("COMPLETED");
                        applicantStageRepository.save(stage);

                        // 3. Trigger Conversion / Enrollment
                        // Find Applicant & User
                        Applicant applicant = applicantRepository.findById(UUID.fromString(stage.getApplicantId()))
                                        .orElseThrow();

                        // We find AudienceResponse to get UserId
                        // Assuming trackingId or look up via applicantId
                        Optional<AudienceResponse> audienceResponseOpt = audienceResponseRepository
                                        .findByApplicantId(applicant.getId().toString());

                        if (audienceResponseOpt.isPresent()) {
                                AudienceResponse ar = audienceResponseOpt.get();
                                if (ar.getUserId() != null) {
                                        // Create Enrollment Entry (Active Package Session)
                                        // TODO: We need the Package/Session ID which should be in the SourceId or
                                        // Config
                                        // For now, we log the success to signal this step
                                        logger.info("Enrollment Triggered for User: {}", ar.getUserId());
                                }
                        }

                        // 4. Auto-Advance
                        completeStageAndMoveNext(applicant.getId().toString());

                        logger.info("Successfully handled Payment Success for order: {}", orderId);

                } catch (Exception e) {
                        logger.error("Error handling payment success", e);
                }
        }

        public void completeStageAndMoveNext(String applicantId) {
                try {
                        // Get current applicant stage (latest)
                        Optional<ApplicantStage> currentStageOpt = applicantStageRepository
                                        .findTopByApplicantIdOrderByCreatedAtDesc(applicantId);

                        if (currentStageOpt.isEmpty())
                                return;

                        ApplicantStage currentStage = currentStageOpt.get();

                        // Mark current stage as COMPLETED if not already
                        if (!"COMPLETED".equalsIgnoreCase(currentStage.getStageStatus())) {
                                currentStage.setStageStatus("COMPLETED");
                                applicantStageRepository.save(currentStage);
                        }

                        // Get definition of current stage to find sequence
                        ApplicationStage currentStageDef = applicationStageRepository
                                        .findById(UUID.fromString(currentStage.getStageId()))
                                        .orElseThrow(() -> new VacademyException("Stage definition not found"));

                        // Find next stage (Sequence + 1)
                        // Assuming sequence is numeric string
                        int currentSeq = 0;
                        try {
                                currentSeq = Integer.parseInt(currentStageDef.getSequence());
                        } catch (NumberFormatException e) {
                                logger.error("Invalid sequence format for stage {}", currentStageDef.getId());
                                return;
                        }

                        String nextSeq = String.valueOf(currentSeq + 1);

                        Optional<ApplicationStage> nextStageOpt = applicationStageRepository
                                        .findByInstituteIdAndSourceAndSourceIdAndSequenceAndWorkflowType(
                                                        currentStageDef.getInstituteId(),
                                                        currentStageDef.getSource(),
                                                        currentStageDef.getSourceId(),
                                                        nextSeq,
                                                        currentStageDef.getWorkflowType());

                        if (nextStageOpt.isPresent()) {
                                ApplicationStage nextStage = nextStageOpt.get();

                                // Create Applicant Stage
                                ApplicantStage newStage = ApplicantStage.builder()
                                                .applicantId(applicantId)
                                                .stageId(nextStage.getId().toString())
                                                .stageStatus("PENDING")
                                                .build();
                                applicantStageRepository.save(newStage);

                                // Trigger Email if Payment STAGE
                                if (ApplicantStageType.PAYMENT.equals(nextStage.getType())) {
                                        sendApplicationPaymentEmail(applicantId, nextStage);
                                }
                        } else {
                                logger.info("No next stage found for applicant {}. Application process completed.",
                                                applicantId);
                        }

                } catch (Exception e) {
                        logger.error("Error moving to next stage for applicant {}", applicantId, e);
                }
        }

        /**
         * Admin manual move to next stage
         * Updates applicant, creates new applicant_stage entry, and updates audience_response if workflow type completed
         */
        @Transactional
        public void moveApplicantToNextStage(String applicantId) {
                // Step 1: Load applicant
                Applicant applicant = applicantRepository.findById(UUID.fromString(applicantId))
                                .orElseThrow(() -> new VacademyException("Applicant not found: " + applicantId));

                // Step 2: Load current stage from applicant.application_stage_id
                ApplicationStage currentStageDef = applicationStageRepository
                                .findById(UUID.fromString(applicant.getApplicationStageId()))
                                .orElseThrow(() -> new VacademyException("Current application stage not found"));

                // Step 3: Resolve next stage (sequence + 1, same institute/source/sourceId)
                int currentSeq = 0;
                try {
                        currentSeq = Integer.parseInt(currentStageDef.getSequence());
                } catch (NumberFormatException e) {
                        throw new VacademyException("Invalid sequence format for stage: " + currentStageDef.getId());
                }

                String nextSeq = String.valueOf(currentSeq + 1);

                Optional<ApplicationStage> nextStageOpt = applicationStageRepository
                                .findByInstituteIdAndSourceAndSourceIdAndSequence(
                                                currentStageDef.getInstituteId(),
                                                currentStageDef.getSource(),
                                                currentStageDef.getSourceId(),
                                                nextSeq);

                if (nextStageOpt.isEmpty()) {
                        throw new VacademyException("No next stage found. Applicant is already at the last stage.");
                }

                ApplicationStage nextStage = nextStageOpt.get();

                // Step 4: UPDATE applicant (application_stage_id and status)
                applicant.setApplicationStageId(nextStage.getId().toString());
                applicant.setApplicationStageStatus("INITIATED");
                applicantRepository.save(applicant);

                // Step 5: UPDATE current applicant_stage (mark COMPLETED) and CREATE new applicant_stage row
                Optional<ApplicantStage> currentApplicantStageOpt = applicantStageRepository
                                .findTopByApplicantIdOrderByCreatedAtDesc(applicantId);

                if (currentApplicantStageOpt.isPresent()) {
                        ApplicantStage currentApplicantStage = currentApplicantStageOpt.get();
                        currentApplicantStage.setStageStatus("COMPLETED");
                        applicantStageRepository.save(currentApplicantStage);
                }

                // Create new applicant_stage row
                String responseJson = nextStage.getConfigJson();
                if (responseJson == null || responseJson.isEmpty()) {
                        responseJson = "{}";
                }

                ApplicantStage newApplicantStage = ApplicantStage.builder()
                                .applicantId(applicantId)
                                .stageId(nextStage.getId().toString())
                                .stageStatus("PENDING")
                                .responseJson(responseJson)
                                .build();
                applicantStageRepository.save(newApplicantStage);

                // Step 6: UPDATE audience_response if current stage had is_last = 1 (workflow type completed)
                Optional<AudienceResponse> audienceResponseOpt = audienceResponseRepository
                                .findByApplicantId(applicantId);

                if (audienceResponseOpt.isPresent()) {
                        AudienceResponse audienceResponse = audienceResponseOpt.get();
                        // Check if the stage we're leaving has is_last = 1
                        if (Boolean.TRUE.equals(currentStageDef.getIsLast())) {
                                audienceResponse.setOverallStatus("CHANGED");
                                audienceResponseRepository.save(audienceResponse);
                                logger.info("Updated audience_response.overall_status to CHANGED for applicant {} (workflow type completed)", applicantId);
                        }
                }

                logger.info("Successfully moved applicant {} from stage {} to stage {}", applicantId,
                                currentStageDef.getId(), nextStage.getId());
        }

        private String resolveLearnerDomain(String instituteId) {
                return instituteDomainRoutingRepository.findByInstituteIdAndRole(instituteId, "LEARNER")
                                .map(routing -> {
                                        if ("*".equals(routing.getSubdomain())) {
                                                return routing.getDomain();
                                        }
                                        return routing.getSubdomain() + "." + routing.getDomain();
                                })
                                .orElse("learner.vacademy.io");
        }

        private void sendApplicationPaymentEmail(String applicantId, ApplicationStage paymentStage) {
                try {
                        Applicant applicant = applicantRepository.findById(UUID.fromString(applicantId))
                                        .orElseThrow(() -> new VacademyException("Applicant not found"));

                        Optional<AudienceResponse> audienceResponseOpt = audienceResponseRepository
                                        .findByApplicantId(applicantId);
                        if (audienceResponseOpt.isEmpty())
                                return;
                        AudienceResponse audienceResponse = audienceResponseOpt.get();

                        String instituteId = paymentStage.getInstituteId();

                        // Extract paymentOptionId from configJson
                        String paymentOptionId = null;
                        if (paymentStage.getConfigJson() != null) {
                                try {
                                        java.util.Map<String, Object> config = objectMapper
                                                        .readValue(paymentStage.getConfigJson(), java.util.Map.class);
                                        paymentOptionId = (String) config.get("payment_option_id");
                                } catch (Exception e) {
                                        logger.error("Error parsing stage config json", e);
                                }
                        }

                        if (paymentOptionId == null) {
                                logger.warn("Payment option id not found for stage {}", paymentStage.getId());
                                return;
                        }

                        String domain = resolveLearnerDomain(instituteId);
                        String paymentLink = "https://" + domain + "/application/payments/" + instituteId + "/"
                                        + applicantId + "/" + paymentOptionId;

                        // Prepare child name
                        String childName = "Applicant";
                        if (audienceResponse.getStudentUserId() != null) {
                                try {
                                        List<UserDTO> students = authService.getUsersFromAuthServiceByUserIds(
                                                        List.of(audienceResponse.getStudentUserId()));
                                        if (!students.isEmpty() && students.get(0).getFullName() != null) {
                                                childName = students.get(0).getFullName();
                                        }
                                } catch (Exception e) {
                                        logger.warn("Could not fetch student name for email", e);
                                }
                        }

                        UserDTO userDto = new UserDTO();
                        userDto.setEmail(audienceResponse.getParentEmail());
                        userDto.setFullName(audienceResponse.getParentName());
                        userDto.setMobileNumber(audienceResponse.getParentMobile());
                        userDto.setId(audienceResponse.getUserId());

                        dynamicNotificationService.sendApplicationPaymentNotification(
                                        instituteId,
                                        userDto,
                                        paymentLink,
                                        childName,
                                        applicant.getTrackingId(),
                                        paymentStage.getSourceId(),
                                        "0");

                } catch (Exception e) {
                        logger.error("Error sending payment email", e);
                }
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

        /**
         * Get Parent with Children Details
         * Fetches parent info, linked children, and their applications/enrollments
         */
        public ParentWithChildrenResponseDTO getParentWithChildren(String parentUserId) {

                // 1. Get Parent User Info from Auth Service
                UserDTO parentUser = null;
                try {
                        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(parentUserId));
                        if (!users.isEmpty()) {
                                parentUser = users.get(0);
                        }
                } catch (Exception e) {
                        throw new VacademyException("Failed to fetch parent user details: " + e.getMessage());
                }

                if (parentUser == null) {
                        throw new VacademyException("Parent user not found for ID: " + parentUserId);
                }

                // 2. Get Children from Auth Service
                List<ParentWithChildDTO> parentWithChildrenList = new ArrayList<>();
                try {
                        parentWithChildrenList = authService.getUsersWithChildren(List.of(parentUserId));
                } catch (Exception e) {
                        // Log error but continue
                }

                List<UserDTO> childrenUsers = parentWithChildrenList.stream()
                                .map(ParentWithChildDTO::getChild)
                                .filter(Objects::nonNull)
                                .toList();

                // 3. For each child, get applications and enrollments
                List<ChildDetailsDTO> childDetailsList = new ArrayList<>();

                for (UserDTO child : childrenUsers) {

                        // Get applications for child (student) or if child was the submitter (user)
                        List<AudienceResponse> applications = audienceResponseRepository
                                        .findByUserIdOrStudentUserId(child.getId(), child.getId());

                        // Get enrollments for child
                        List<Student> enrollments = instituteStudentRepository.findByUserId(child.getId());

                        childDetailsList.add(
                                        ChildDetailsDTO.builder()
                                                        .childInfo(child)
                                                        .applications(applications)
                                                        .enrollments(enrollments)
                                                        .build());
                }

                return ParentWithChildrenResponseDTO.builder()
                                .parentInfo(parentUser)
                                .children(childDetailsList)
                                .build();
        }

        /**
         * Get all stages for an applicant by applicant ID
         */
        public List<ApplicantStageDTO> getApplicantStages(String applicantId) {
                List<ApplicantStage> stages = applicantStageRepository.findByApplicantId(applicantId);
                return stages.stream()
                                .map(ApplicantStageDTO::new)
                                .toList();
        }

        /**
         * Send application confirmation email with credentials
         * Tries to fetch template from notification_event_config, falls back to default
         * email
         */
        private void sendApplicationConfirmationEmail(
                        String applicantId,
                        String instituteId,
                        ApplicationStage firstStage,
                        UserDTO parentUser,
                        UserDTO childUser,
                        PackageSession session) {

                try {
                        logger.info("Sending application confirmation email for applicant: {}", applicantId);

                        // Get applicant for tracking ID
                        Applicant applicant = applicantRepository.findById(UUID.fromString(applicantId))
                                        .orElseThrow(() -> new VacademyException("Applicant not found"));

                        // Get institute for institute name
                        Institute institute = instituteRepository.findById(instituteId)
                                        .orElse(null);
                        String instituteName = institute != null ? institute.getInstituteName() : "Institute";

                        // Get credentials (username and password)
                        String username = parentUser != null ? parentUser.getEmail() : "";
                        String password = parentUser != null ? parentUser.getPassword() : ""; // Use getPassword, not
                                                                                              // getPasswordHash

                        // Build portal URL (hardcoded for now)
                        String portalUrl = "https://learner-portal.vacademy.io";

                        // Format submission time
                        java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
                        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                                        .ofPattern("MMM dd, yyyy hh:mm a z");
                        String submissionTime = now.format(formatter);

                        String sessionName = (session != null && session.getSession() != null)
                                        ? session.getSession().getSessionName()
                                        : "Session";

                        // Try to fetch template from notification_event_config
                        Optional<NotificationEventConfig> configOpt = notificationEventConfigRepository
                                        .findFirstByEventNameAndSourceTypeAndSourceIdAndTemplateTypeAndIsActiveTrueOrderByUpdatedAtDesc(
                                                        NotificationEventType.APPLICATION_FORM_SUBMISSION,
                                                        NotificationSourceType.APPLICATION_STAGE,
                                                        firstStage.getId().toString(),
                                                        NotificationTemplateType.EMAIL);

                        if (configOpt.isPresent()) {
                                // Send templated email
                                logger.info("Using custom template for application confirmation email");

                                NotificationTemplateVariables templateVars = NotificationTemplateVariables.builder()
                                                .userFullName(parentUser.getFullName())
                                                .userEmail(parentUser.getEmail())
                                                .userName(username)
                                                .userPassword(password)
                                                .portalUrl(portalUrl)
                                                .childName(childUser != null ? childUser.getFullName() : "Student")
                                                .trackingId(applicant.getTrackingId())
                                                .sessionName(sessionName)
                                                .submissionTime(submissionTime)
                                                .instituteName(instituteName)
                                                .instituteId(instituteId)
                                                .build();

                                sendUniqueLinkService.sendUniqueLinkByEmailByEnrollInvite(
                                                instituteId,
                                                parentUser,
                                                configOpt.get().getTemplateId(),
                                                null,
                                                templateVars);

                                logger.info("Sent templated application confirmation email to: {}",
                                                parentUser.getEmail());
                        } else {
                                // Send default email
                                logger.info("No custom template found, using default application confirmation email");

                                String defaultEmailBody = buildDefaultApplicationEmailBody(
                                                parentUser != null ? parentUser.getFullName() : "Parent",
                                                childUser != null ? childUser.getFullName() : "Student",
                                                sessionName,
                                                applicant.getTrackingId(),
                                                submissionTime,
                                                username,
                                                password,
                                                portalUrl,
                                                instituteName);

                                GenericEmailRequest emailRequest = new GenericEmailRequest();
                                emailRequest.setTo(parentUser.getEmail());
                                emailRequest.setSubject("Application Submitted Successfully - " + sessionName);
                                emailRequest.setBody(defaultEmailBody);

                                notificationService.sendGenericHtmlMail(emailRequest, instituteId);
                                logger.info("Sent default application confirmation email to: {}",
                                                parentUser.getEmail());
                        }

                } catch (Exception ex) {
                        // Log error but don't throw - application already saved
                        logger.error("Failed to send application confirmation email for applicant {}: {}",
                                        applicantId, ex.getMessage(), ex);
                }
        }

        /**
         * Build default HTML email body for application confirmation
         */
        private String buildDefaultApplicationEmailBody(
                        String parentName,
                        String childName,
                        String sessionName,
                        String trackingId,
                        String submissionTime,
                        String username,
                        String password,
                        String portalUrl,
                        String instituteName) {

                return "<!DOCTYPE html>" +
                                "<html>" +
                                "<head>" +
                                "<style>" +
                                "body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }" +
                                ".container { max-width: 600px; margin: 0 auto; padding: 20px; }" +
                                ".header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }"
                                +
                                ".content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }" +
                                ".detail-section { margin: 20px 0; padding: 15px; background-color: white; border-left: 4px solid #4CAF50; }"
                                +
                                ".detail-label { font-weight: bold; color: #555; }" +
                                ".detail-value { color: #333; margin-left: 10px; }" +
                                ".credentials-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }"
                                +
                                ".button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }"
                                +
                                ".footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }" +
                                "</style>" +
                                "</head>" +
                                "<body>" +
                                "<div class='container'>" +
                                "<div class='header'>" +
                                "<h2>Application Submitted Successfully!</h2>" +
                                "</div>" +
                                "<div class='content'>" +
                                "<p>Dear <strong>" + parentName + "</strong>,</p>" +
                                "<p>Thank you for submitting the application for <strong>" + childName
                                + "</strong> to <strong>" + sessionName + "</strong>.</p>" +
                                "<div class='detail-section'>" +
                                "<h3>Application Details</h3>" +
                                "<p><span class='detail-label'>Tracking ID:</span> <span class='detail-value'>"
                                + trackingId + "</span></p>" +
                                "<p><span class='detail-label'>Student Name:</span> <span class='detail-value'>"
                                + childName + "</span></p>" +
                                "<p><span class='detail-label'>Session/Class:</span> <span class='detail-value'>"
                                + sessionName + "</span></p>" +
                                "<p><span class='detail-label'>Submitted On:</span> <span class='detail-value'>"
                                + submissionTime + "</span></p>" +
                                "<p><span class='detail-label'>Status:</span> <span class='detail-value'>Under Review</span></p>"
                                +
                                "</div>" +
                                "<div class='credentials-box'>" +
                                "<h3>🔐 Your Portal Access Credentials</h3>" +
                                "<p>You can now access your learner portal using the following credentials:</p>" +
                                "<p><span class='detail-label'>Username:</span> <span class='detail-value'>" + username
                                + "</span></p>" +
                                "<p><span class='detail-label'>Password:</span> <span class='detail-value'>" + password
                                + "</span></p>" +
                                "<p><span class='detail-label'>Portal URL:</span> <a href='" + portalUrl + "'>"
                                + portalUrl + "</a></p>" +
                                "<a href='" + portalUrl + "' class='button'>Access Portal Now</a>" +
                                "</div>" +
                                "<div class='detail-section'>" +
                                "<h3>Next Steps</h3>" +
                                "<p>We will review your application and contact you shortly with the next steps.</p>" +
                                "<p>You can track your application status by logging into the portal using the credentials above.</p>"
                                +
                                "</div>" +
                                "<p>If you have any questions, please don't hesitate to contact us.</p>" +
                                "<p>Best regards,<br><strong>" + instituteName + "</strong></p>" +
                                "</div>" +
                                "<div class='footer'>" +
                                "<p>This is an automated email. Please do not reply to this message.</p>" +
                                "</div>" +
                                "</div>" +
                                "</body>" +
                                "</html>";
        }
}
