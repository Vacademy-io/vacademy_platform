package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;

import java.util.List;
import java.util.Optional;

public interface OnboardingStepInstanceRepository extends JpaRepository<OnboardingStepInstance, String> {
    List<OnboardingStepInstance> findByOnboardingInstanceId(String onboardingInstanceId);

    Optional<OnboardingStepInstance> findByOnboardingInstanceIdAndStepId(String onboardingInstanceId, String stepId);
}
