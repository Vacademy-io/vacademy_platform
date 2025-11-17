package vacademy.io.admin_core_service.features.learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgResponseDTO;
import vacademy.io.admin_core_service.features.learner.dto.StudentMappingWithUserDTO;
import vacademy.io.admin_core_service.features.learner.dto.SubOrgDetailsDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgService {

    private final InstituteStudentRepository instituteStudentRepository;
    private final InstituteRepository instituteRepository;
    private final AuthService authService;

    /**
     * Get all enrolled users with their mapping details from student_session_institute_group_mapping
     * 
     * @param packageSessionId The course/batch ID
     * @param subOrgId The purchasing institute ID
     * @return Response with sub-org details and list of student mappings with user details
     */
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
}
