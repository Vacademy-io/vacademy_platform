package vacademy.io.admin_core_service.features.institute_learner.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchProjection;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LearnerBatchService {
    private final StudentSessionRepository studentSessionRepository;

    public List<LearnerBatchProjection> getBatchesWithLearnerCountByInstituteId(String instituteId, CustomUserDetails userDetails) {
        return studentSessionRepository.getPackageSessionsWithEnrollment(instituteId, List.of("ACTIVE"));
    }

}
