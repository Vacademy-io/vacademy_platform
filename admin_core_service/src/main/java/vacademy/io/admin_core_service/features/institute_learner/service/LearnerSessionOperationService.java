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

        List<StudentSessionInstituteGroupMapping> mappings = requestDTO.getUserIds().stream()
                .flatMap(userId -> createStudentMappings(userId, requestDTO.getInstituteId(), requestDTO.getLearnerBatchRegisterInfos()).stream())
                .collect(Collectors.toList());

        studentSessionRepository.saveAll(mappings);
        return "success";
    }

    private List<StudentSessionInstituteGroupMapping> createStudentMappings(String userId, String instituteId, List<LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo> packageSessionDetails) {
        StudentSessionInstituteGroupMapping existingMapping = getStudentSessionMapping(userId, instituteId);

        return packageSessionDetails.stream()
                .map(packageInfo -> buildStudentSessionMapping(userId, packageInfo.getAccessDays(), packageInfo.getPackageSessionId(), existingMapping))
                .collect(Collectors.toList());
    }

    private StudentSessionInstituteGroupMapping buildStudentSessionMapping(String userId, Integer accessDays, String packageSessionId, StudentSessionInstituteGroupMapping existingMapping) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found"));

        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setUserId(userId);
        mapping.setPackageSession(packageSession);
        mapping.setInstitute(existingMapping.getInstitute());
        mapping.setGroup(existingMapping.getGroup());
        mapping.setStatus(LearnerSessionStatusEnum.ACTIVE.name());
        mapping.setEnrolledDate(new Date());
        mapping.setInstituteEnrolledNumber(existingMapping.getInstituteEnrolledNumber());
        mapping.setExpiryDate(makeExpiryDate(existingMapping.getEnrolledDate(), accessDays));
        return mapping;
    }

    private StudentSessionInstituteGroupMapping getStudentSessionMapping(String userId, String instituteId) {
        return studentSessionRepository.findByInstituteIdAndUserIdNative(instituteId, userId)
                .orElseThrow(() -> new VacademyException("Student Session not found"));
    }

    private List<PackageSession> fetchPackageSessions(List<LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo> packageSessionDetails) {
        List<String> packageSessionIds = packageSessionDetails.stream()
                .map(LearnerBatchRegisterRequestDTO.LearnerBatchRegisterInfo::getPackageSessionId)
                .collect(Collectors.toList());
        return packageSessionRepository.findAllById(packageSessionIds);
    }

    private Date makeExpiryDate(Date enrollmentDate, Integer accessDays) {
        if (enrollmentDate == null || accessDays == null) {
            return null;
        }
        Date expiryDate = new Date(enrollmentDate.getTime() + (long) accessDays * 24 * 60 * 60 * 1000);
        return expiryDate;
    }
}
