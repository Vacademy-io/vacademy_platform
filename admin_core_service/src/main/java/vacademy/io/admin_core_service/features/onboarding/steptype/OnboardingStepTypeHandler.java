package vacademy.io.admin_core_service.features.onboarding.steptype;

import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;
import vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStepInstanceStatus;

import java.util.Map;

/**
 * Pluggable per-step-type behavior, mirroring the workflow engine's NodeHandler(Registry)
 * pattern. v1 ships {@link FormStepTypeHandler} only -- new step types (payment, delivery,
 * approval, ...) are added by implementing this interface, no changes needed to the core
 * flow/instance model or to {@link OnboardingStepTypeHandlerRegistry}.
 */
public interface OnboardingStepTypeHandler {

    boolean supports(String stepType);

    /** Called when a subject enters this step (right after the step instance becomes IN_PROGRESS). */
    default void onEnter(OnboardingStepInstance stepInstance, OnboardingStep step) {
        // no-op by default
    }

    /**
     * Called with a role-scoped submission payload. Returns the resulting step-instance
     * status (typically COMPLETED, but a handler may return IN_PROGRESS if the submission
     * was only a partial save).
     */
    OnboardingStepInstanceStatus onSubmit(OnboardingStepInstance stepInstance,
                                           OnboardingStep step,
                                           Map<String, Object> payload,
                                           String actorRoleKey,
                                           String actorUserId);
}
