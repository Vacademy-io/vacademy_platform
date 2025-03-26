package vacademy.io.admin_core_service.features.institute_learner.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchRegisterRequestDTO;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearnerSessionOperationService {

    private final StudentSessionRepository studentSessionRepository;
    private final PackageSessionRepository packageSessionRepository;

    @Transactional
    public String addPackageSessionsToLearner(LearnerBatchRegisterRequestDTO requestDTO, CustomUserDetails userDetails) {
        List<String> packageSessionIds = extractPackageSessionIds(requestDTO.getCommaSeparatedPackageSessionIds());
        List<PackageSession> packageSessions = fetchPackageSessions(packageSessionIds);

        List<StudentSessionInstituteGroupMapping> mappings = requestDTO.getUserIds().stream()
                .map(userId -> createStudentMappings(userId, requestDTO.getInstituteId(), packageSessions))
                .flatMap(List::stream)
                .collect(Collectors.toList());

        studentSessionRepository.saveAll(mappings);
        return "success";
    }

    private List<StudentSessionInstituteGroupMapping> createStudentMappings(String userId, String instituteId, List<PackageSession> packageSessions) {
        StudentSessionInstituteGroupMapping existingMapping = getStudentSessionMapping(userId, instituteId);

        return packageSessions.stream()
                .map(packageSession -> buildStudentSessionMapping(userId, packageSession, existingMapping))
                .collect(Collectors.toList());
    }

    private StudentSessionInstituteGroupMapping buildStudentSessionMapping(String userId, PackageSession packageSession, StudentSessionInstituteGroupMapping existingMapping) {
        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(packageSession);
        mapping.setInstitute(existingMapping.getInstitute());
        mapping.setGroup(existingMapping.getGroup());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setInstituteEnrolledNumber(existingMapping.getInstituteEnrolledNumber());
        return mapping;
    }

    private StudentSessionInstituteGroupMapping getStudentSessionMapping(String userId, String instituteId) {
        return studentSessionRepository.findByInstituteIdAndUserIdNative(instituteId, userId)
                .orElseThrow(() -> new VacademyException("Student Session not found"));
    }

    private List<PackageSession> fetchPackageSessions(List<String> packageSessionIds) {
        return packageSessionRepository.findAllById(packageSessionIds);
    }

    private List<String> extractPackageSessionIds(String packageSessionIds) {
        return List.of(packageSessionIds.trim().split(","));
    }
}
