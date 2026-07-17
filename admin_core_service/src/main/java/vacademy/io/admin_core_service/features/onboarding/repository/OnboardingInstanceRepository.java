package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;

import java.util.List;

public interface OnboardingInstanceRepository extends JpaRepository<OnboardingInstance, String> {
    List<OnboardingInstance> findBySubjectUserIdAndInstituteId(String subjectUserId, String instituteId);

    List<OnboardingInstance> findByFlowIdAndStatus(String flowId, String status);

    List<OnboardingInstance> findByInstituteIdAndStatus(String instituteId, String status);
}
