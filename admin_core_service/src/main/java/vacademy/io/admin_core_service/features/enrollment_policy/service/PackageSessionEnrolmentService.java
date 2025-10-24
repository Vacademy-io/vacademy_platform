package vacademy.io.admin_core_service.features.enrollment_policy.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentProcessorFactory;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PackageSessionEnrolmentService {

    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final EnrolmentProcessorFactory processorFactory;
    private final ObjectMapper objectMapper;
    private final AuthService authService;

    public void processActiveEnrollments() {
        List<StudentSessionInstituteGroupMapping> activeMappings =
                mappingRepository.findByInstitute_IdAndStatus("c5e2ea87-6fc3-44c7-8e42-f38297dff490",LearnerSessionStatusEnum.ACTIVE.name());

        log.info("Found {} active enrollments to process.", activeMappings.size());
        if (activeMappings.isEmpty()) return;


        List<String> userIds = activeMappings.stream()
                .map(StudentSessionInstituteGroupMapping::getUserId)
                .distinct()
                .toList();

        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);

        Map<String, UserDTO> userMap = users.stream()
                .collect(Collectors.toMap(UserDTO::getId, u -> u));

        for (StudentSessionInstituteGroupMapping mapping : activeMappings) {
            try {
                processSingleMapping(mapping, userMap);
            } catch (Exception e) {
                log.error("Failed to process mapping for student_session_id: {}", mapping.getId(), e);
            }
        }
    }

    private void processSingleMapping(StudentSessionInstituteGroupMapping mapping, Map<String, UserDTO> userMap) {
        String policyJson = mapping.getPackageSession().getEnrollmentPolicySettings();

        if (policyJson == null || policyJson.isBlank()) {
            log.warn("Skipping mapping {}: No enrollmentPolicySettings JSON found.", mapping.getId());
            return;
        }

        EnrollmentPolicySettingsDTO policy = parsePolicy(policyJson, mapping.getId());
        if (policy == null) return;

        UserDTO user = userMap.get(mapping.getUserId());
        if (user == null) {
            log.warn("User not found for ID {} in AuthService result, skipping.", mapping.getUserId());
            return;
        }

        EnrolmentContext context = EnrolmentContext.builder()
                .mapping(mapping)
                .policy(policy)
                .user(user)
                .build();

        processorFactory.getProcessor(context)
                .ifPresent(processor -> processor.process(context));
    }

    private EnrollmentPolicySettingsDTO parsePolicy(String json, String mappingId) {
        try {
            return objectMapper.readValue(json, EnrollmentPolicySettingsDTO.class);
        } catch (Exception e) {
            log.error("Failed to parse enrollment policy JSON for mapping {}: {}", mappingId, e.getMessage());
            return null;
        }
    }
}
