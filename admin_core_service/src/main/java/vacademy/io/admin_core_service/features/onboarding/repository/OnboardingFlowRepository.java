package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingFlow;

import java.util.List;

public interface OnboardingFlowRepository extends JpaRepository<OnboardingFlow, String> {
    List<OnboardingFlow> findByInstituteIdAndStatus(String instituteId, String status);

    List<OnboardingFlow> findByInstituteId(String instituteId);
}
