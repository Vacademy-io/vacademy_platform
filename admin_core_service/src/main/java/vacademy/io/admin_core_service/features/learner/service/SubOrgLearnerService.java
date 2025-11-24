package vacademy.io.admin_core_service.features.learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.enroll_invite.enums.SubOrgRoles;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner.dto.*;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgLearnerService {

    private final AuthService authService;
    private final InstituteStudentRepository instituteStudentRepository;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final InstituteRepository instituteRepository;
    private final CustomFieldValueService customFieldValueService;

    @Transactional(readOnly = true)
    public SubOrgResponseDTO getUsersByPackageSessionAndSubOrg(
            String packageSessionId,
            String subOrgId) {

        log.info("Fetching student mappings for package_session_id: {} and sub_org_id: {}", packageSessionId, subOrgId);

        // Validate and fetch sub-organization (institute)
        Institute subOrg = instituteRepository.findById(subOrgId)
                .orElseThrow(() -> new VacademyException("Sub-organization not found with id: " + subOrgId));

        // Query to get all mapping rows for this sub-org and package session
        List<Object[]> mappingData = instituteStudentRepository
                .findMappingsByPackageSessionAndSubOrg(packageSessionId, subOrgId);

        log.info("Found {} student mappings for package_session_id: {} and sub_org_id: {}",
                mappingData.size(), packageSessionId, subOrgId);

        // Extract unique user IDs
        Set<String> userIds = new HashSet<>();
        for (Object[] row : mappingData) {
            if (row[1] != null) { // row[1] is user_id
                userIds.add((String) row[1]);
            }
        }

        // Fetch complete user details from auth service
        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds));

        // Create a map for quick lookup
        Map<String, UserDTO> userMap = users.stream()
                .collect(Collectors.toMap(UserDTO::getId, Function.identity()));

        log.info("Successfully fetched {} user details", users.size());

        // Build list of student mappings with user details
        List<StudentMappingWithUserDTO> studentMappings = new ArrayList<>();
        for (Object[] row : mappingData) {
            StudentMappingWithUserDTO mapping = buildStudentMappingWithUser(row, userMap);
            if (mapping != null) {
                studentMappings.add(mapping);
            }
        }

        // Build sub-org details
        SubOrgDetailsDTO subOrgDetails = buildSubOrgDetails(subOrg);

        // Build and return response
        SubOrgResponseDTO response = new SubOrgResponseDTO();
        response.setSubOrgDetails(subOrgDetails);
        response.setStudentMappings(studentMappings);

        return response;
    }

    private StudentMappingWithUserDTO buildStudentMappingWithUser(Object[] row, Map<String, UserDTO> userMap) {
        if (row == null || row.length < 12) {
            return null;
        }

        String userId = (String) row[1];
        UserDTO user = userMap.get(userId);

        if (user == null) {
            log.warn("User not found for userId: {}", userId);
            return null;
        }

        return StudentMappingWithUserDTO.builder()
                .id((String) row[0])
                .userId(userId)
                .instituteEnrollmentNumber((String) row[2])
                .enrolledDate(row[3] != null ? (Date) row[3] : null)
                .expiryDate(row[4] != null ? (Date) row[4] : null)
                .status((String) row[5])
                .packageSessionId((String) row[6])
                .instituteId((String) row[7])
                .groupId((String) row[8])
                .subOrgId((String) row[9])
                .userPlanId((String) row[10])
                .destinationPackageSessionId((String) row[11])
                .user(user)
                .build();
    }

    /**
     * Build sub-organization details DTO
     */
    private SubOrgDetailsDTO buildSubOrgDetails(Institute institute) {
        SubOrgDetailsDTO dto = new SubOrgDetailsDTO();
        dto.setId(institute.getId());
        dto.setName(institute.getInstituteName());
        dto.setEmail(institute.getEmail());
        dto.setMobileNumber(institute.getMobileNumber());
        dto.setAddress(institute.getAddress());
        dto.setCity(institute.getCity());
        dto.setState(institute.getState());
        dto.setCountry(institute.getCountry());
        dto.setPincode(institute.getPinCode());
        dto.setWebsiteUrl(institute.getWebsiteUrl());
        dto.setStatus("ACTIVE"); // Default status

        return dto;
    }



    @Transactional
    public SubOrgEnrollResponseDTO enrollLearnerToSubOrg(SubOrgEnrollRequestDTO request) {
        log.info("Starting sub-org enrollment for package_session_id: {}, sub_org_id: {}",
                request.getPackageSessionId(), request.getSubOrgId());

        // 1. Validate request
        validateRequest(request);

        // 2. Validate entities exist
        PackageSession packageSession = validatePackageSession(request.getPackageSessionId());
        Institute subOrg = validateSubOrg(request.getSubOrgId());
        validateInstitute(request.getInstituteId());

        // 3. Create or fetch user
        UserDTO user = createOrFetchUser(request);

        // 4. Ensure student record exists
        ensureStudentExists(user);

        // 5. Validate no duplicate enrollment
        validateNoDuplicateEnrollment(user.getId(), request);

        // 6. Create mapping
        StudentSessionInstituteGroupMapping mapping = createMapping(request, user, packageSession, subOrg);
        mapping = mappingRepository.save(mapping);

        log.info("Created mapping with ID: {} for user: {}", mapping.getId(), user.getId());

        // 7. Save custom fields if provided
        if (request.getCustomFieldValues() != null && !request.getCustomFieldValues().isEmpty()) {
            customFieldValueService.addCustomFieldValue(
                    request.getCustomFieldValues(),
                    CustomFieldValueSourceTypeEnum.STUDENT_SESSION_INSTITUTE_GROUP_MAPPING.name(),
                    mapping.getId()
            );
            log.info("Saved {} custom field values for mapping: {}",
                    request.getCustomFieldValues().size(), mapping.getId());
        }

        // 8. Build and return response
        return SubOrgEnrollResponseDTO.builder()
                .user(user)
                .mappingId(mapping.getId())
                .message("Successfully enrolled learner to sub-organization")
                .build();
    }

    /**
     * Validate request has required fields
     */
    private void validateRequest(SubOrgEnrollRequestDTO request) {
        if (request.getUser() == null) {
            throw new VacademyException("User details are required");
        }
        if (!StringUtils.hasText(request.getPackageSessionId())) {
            throw new VacademyException("Package session ID is required");
        }
        if (!StringUtils.hasText(request.getSubOrgId())) {
            throw new VacademyException("Sub-organization ID is required");
        }
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("Institute ID is required");
        }
    }

    /**
     * Validate package session exists and is active
     */
    private PackageSession validatePackageSession(String packageSessionId) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found with id: " + packageSessionId));

        if (!PackageSessionStatusEnum.ACTIVE.name().equals(packageSession.getStatus())) {
            throw new VacademyException("Package session is not active. Current status: " + packageSession.getStatus());
        }

        return packageSession;
    }

    /**
     * Validate sub-organization exists
     */
    private Institute validateSubOrg(String subOrgId) {
        return instituteRepository.findById(subOrgId)
                .orElseThrow(() -> new VacademyException("Sub-organization not found with id: " + subOrgId));
    }

    /**
     * Validate main institute exists
     */
    private void validateInstitute(String instituteId) {
        instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found with id: " + instituteId));
    }

    /**
     * Create new user or fetch existing user
     */
    private UserDTO createOrFetchUser(SubOrgEnrollRequestDTO request) {
        if (!StringUtils.hasText(request.getUser().getId())) {
            log.info("Creating new user with email: {}", request.getUser().getEmail());
            return authService.createUserFromAuthService(
                    request.getUser(),
                    request.getInstituteId(),
                    false // Don't send credentials
            );
        } else {
            log.info("Using existing user with ID: {}", request.getUser().getId());
            return request.getUser();
        }
    }

    /**
     * Ensure student record exists for the user
     */
    private void ensureStudentExists(UserDTO user) {
        Optional<Student> studentOpt = instituteStudentRepository.findTopByUserIdOrderByCreatedAtDesc(user.getId());
        if (studentOpt.isEmpty()) {
            log.info("Creating student record for user: {}", user.getId());
            Student student = new Student(user);
            instituteStudentRepository.save(student);
        }
    }

    /**
     * Validate no duplicate active enrollment exists
     */
    private void validateNoDuplicateEnrollment(String userId, SubOrgEnrollRequestDTO request) {
        Optional<StudentSessionInstituteGroupMapping> existingMapping = mappingRepository
                .findByUserIdAndPackageSessionIdAndInstituteId(
                        userId,
                        request.getPackageSessionId(),
                        request.getInstituteId()
                );

        if (existingMapping.isPresent()) {
            StudentSessionInstituteGroupMapping mapping = existingMapping.get();
            if (LearnerSessionStatusEnum.ACTIVE.name().equals(mapping.getStatus()) &&
                    request.getSubOrgId().equals(mapping.getSubOrg() != null ? mapping.getSubOrg().getId() : null)) {
                throw new VacademyException("User is already enrolled in this package session through the same sub-organization");
            }
        }
    }

    /**
     * Create student session institute group mapping
     */
    private StudentSessionInstituteGroupMapping createMapping(
            SubOrgEnrollRequestDTO request,
            UserDTO user,
            PackageSession packageSession,
            Institute subOrg) {

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();

        // Basic fields
        mapping.setUserId(user.getId());
        mapping.setPackageSession(packageSession);
        mapping.setSubOrg(subOrg);

        // Institute and group
        Institute institute = new Institute();
        institute.setId(request.getInstituteId());
        mapping.setInstitute(institute);

        if (StringUtils.hasText(request.getGroupId())) {
            Group group = new Group();
            group.setId(request.getGroupId());
            mapping.setGroup(group);
        }

        // Dates
        mapping.setEnrolledDate(request.getEnrolledDate() != null ? request.getEnrolledDate() : new Date());
        mapping.setExpiryDate(request.getExpiryDate());
        if(request.getCommaSeparatedOrgRoles()!=null)
            mapping.setCommaSeparatedOrgRoles(request.getCommaSeparatedOrgRoles());

        // Status and enrollment number
        mapping.setStatus(StringUtils.hasText(request.getStatus()) ?
                request.getStatus() : LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setInstituteEnrolledNumber(request.getInstituteEnrollmentNumber());

        // Comma separated org roles
        mapping.setCommaSeparatedOrgRoles(request.getCommaSeparatedOrgRoles());

        // No payment tracking for sub-org enrollments
        mapping.setUserPlanId(null);
        mapping.setDestinationPackageSession(null);

        return mapping;
    }

    @Transactional
    public SubOrgTerminateResponseDTO terminateLearners(SubOrgTerminateRequestDTO request) {
        log.info("Terminating learners for sub_org_id: {}, institute_id: {}, package_session_id: {}, user_count: {}",
                request.getSubOrgId(), request.getInstituteId(), request.getPackageSessionId(), request.getUserIds().size());

        // Validate sub-organization exists
        instituteRepository.findById(request.getSubOrgId())
                .orElseThrow(() -> new VacademyException("Sub-organization not found with id: " + request.getSubOrgId()));

        // Validate institute exists
        instituteRepository.findById(request.getInstituteId())
                .orElseThrow(() -> new VacademyException("Institute not found with id: " + request.getInstituteId()));

        // Validate package session exists
        packageSessionRepository.findById(request.getPackageSessionId())
                .orElseThrow(() -> new VacademyException("Package session not found with id: " + request.getPackageSessionId()));

        // Perform bulk termination
        int terminatedCount = mappingRepository.terminateLearnersBySubOrgAndUserIds(
                request.getSubOrgId(),
                request.getInstituteId(),
                request.getPackageSessionId(),
                request.getUserIds(),
                LearnerSessionStatusEnum.TERMINATED.name()
        );

        log.info("Successfully terminated {} learners", terminatedCount);

        return SubOrgTerminateResponseDTO.builder()
                .terminatedCount(terminatedCount)
                .message("Successfully terminated " + terminatedCount + " learner(s)")
                .build();
    }

    @Transactional(readOnly = true)
    public UserAdminDetailsResponseDTO getAdminDetailsByUserId(String userId) {
        log.info("Fetching admin details for user_id: {}", userId);

        // Find all active mappings where user has ADMIN role
        List<StudentSessionInstituteGroupMapping> adminMappings = mappingRepository
                .findActiveAdminMappingsByUserId(userId, SubOrgRoles.ADMIN.name());

        if (adminMappings.isEmpty()) {
            log.info("No admin mappings found for user_id: {}", userId);
        }

        // Build complete mapping DTOs with sub-org details
        List<StudentSessionMappingWithSubOrgDTO> mappingDTOs = adminMappings.stream()
                .map(this::buildCompleteMappingDTO)
                .toList();

        log.info("Found {} admin mappings for user_id: {}", mappingDTOs.size(), userId);

        return UserAdminDetailsResponseDTO.builder()
                .adminMappings(mappingDTOs)
                .build();
    }

    /**
     * Build complete StudentSessionMappingWithSubOrgDTO from StudentSessionInstituteGroupMapping entity
     */
    private StudentSessionMappingWithSubOrgDTO buildCompleteMappingDTO(StudentSessionInstituteGroupMapping mapping) {
        // Build sub-org (institute) details
        Institute subOrg = mapping.getSubOrg();
        InstituteBasicDTO subOrgDto = null;
        if (subOrg != null) {
            subOrgDto = InstituteBasicDTO.builder()
                    .instituteId(subOrg.getId())
                    .instituteName(subOrg.getInstituteName())
                    .instituteCode(subOrg.getSubdomain())
                    .email(subOrg.getEmail())
                    .mobileNumber(subOrg.getMobileNumber())
                    .address(subOrg.getAddress())
                    .city(subOrg.getCity())
                    .state(subOrg.getState())
                    .country(subOrg.getCountry())
                    .build();
        }

        return StudentSessionMappingWithSubOrgDTO.builder()
                .id(mapping.getId())
                .userId(mapping.getUserId())
                .instituteEnrolledNumber(mapping.getInstituteEnrolledNumber())
                .enrolledDate(mapping.getEnrolledDate())
                .expiryDate(mapping.getExpiryDate())
                .status(mapping.getStatus())
                .createdAt(mapping.getCreatedAt())
                .updatedAt(mapping.getUpdatedAt())
                .groupId(mapping.getGroup() != null ? mapping.getGroup().getId() : null)
                .instituteId(mapping.getInstitute() != null ? mapping.getInstitute().getId() : null)
                .packageSessionId(mapping.getPackageSession() != null ? mapping.getPackageSession().getId() : null)
                .destinationPackageSessionId(mapping.getDestinationPackageSession() != null ? mapping.getDestinationPackageSession().getId() : null)
                .userPlanId(mapping.getUserPlanId())
                .typeId(mapping.getTypeId())
                .type(mapping.getType())
                .source(mapping.getSource())
                .desiredLevelId(mapping.getDesiredLevelId())
                .desiredPackageId(mapping.getDesiredPackageId())
                .automatedCompletionCertificateFileId(mapping.getAutomatedCompletionCertificateFileId())
                .subOrgId(subOrg != null ? subOrg.getId() : null)
                .commaSeparatedOrgRoles(mapping.getCommaSeparatedOrgRoles())
                .subOrgDetails(subOrgDto)
                .build();
    }
}
