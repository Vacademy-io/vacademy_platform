package vacademy.io.admin_core_service.features.onboarding.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;

import java.util.List;
import java.util.Optional;

public interface OnboardingStepRepository extends JpaRepository<OnboardingStep, String> {
    List<OnboardingStep> findByFlowIdAndStatusOrderByStepOrderAsc(String flowId, String status);

    Optional<OnboardingStep> findFirstByFlowIdAndStatusOrderByStepOrderAsc(String flowId, String status);

    /** The next active step after the given order within the flow, if any. */
    Optional<OnboardingStep> findFirstByFlowIdAndStatusAndStepOrderGreaterThanOrderByStepOrderAsc(
            String flowId, String status, Integer stepOrder);

    /**
     * Highest step_order used in this flow across EVERY status, not just ACTIVE --
     * uq_onboarding_step_flow_order doesn't care about status, so a deleted (ARCHIVED) step's
     * order is still taken. Used to pick a new step's order without colliding with it.
     */
    @Query("SELECT COALESCE(MAX(s.stepOrder), 0) FROM OnboardingStep s WHERE s.flowId = :flowId")
    int findMaxStepOrder(@Param("flowId") String flowId);
}
