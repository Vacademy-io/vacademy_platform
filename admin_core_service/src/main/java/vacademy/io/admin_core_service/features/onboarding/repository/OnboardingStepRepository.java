package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;

import java.util.List;
import java.util.Optional;

public interface OnboardingStepRepository extends JpaRepository<OnboardingStep, String> {
    List<OnboardingStep> findByFlowIdAndStatusOrderByStepOrderAsc(String flowId, String status);

    Optional<OnboardingStep> findFirstByFlowIdAndStatusOrderByStepOrderAsc(String flowId, String status);

    /** The next active step after the given order within the flow, if any. */
    Optional<OnboardingStep> findFirstByFlowIdAndStatusAndStepOrderGreaterThanOrderByStepOrderAsc(
            String flowId, String status, Integer stepOrder);
}
