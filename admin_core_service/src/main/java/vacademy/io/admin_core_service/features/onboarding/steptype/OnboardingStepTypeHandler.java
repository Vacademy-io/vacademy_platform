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
     * Called with a role-scoped submission payload.
     *
     * @param requireComplete true for an actual "complete this step" attempt (validates every
     *                         mandatory field is present -- from this payload OR a value saved
     *                         in an earlier call -- and only then returns COMPLETED); false for a
     *                         partial "save progress" call (persists whatever the caller has
     *                         edit access to, skips mandatory validation entirely, and always
     *                         returns IN_PROGRESS). Lets a step whose fields span multiple roles
     *                         (e.g. an admin records a delivery's tracking id/vendor, a student
     *                         later fills in "received?") have each side save their own part
     *                         independently, without either one needing to already know the
     *                         other's data.
     * @return the resulting step-instance status: COMPLETED only when requireComplete is true
     *         AND every mandatory field now has a value; IN_PROGRESS otherwise.
     */
    OnboardingStepInstanceStatus onSubmit(OnboardingStepInstance stepInstance,
                                           OnboardingStep step,
                                           Map<String, Object> payload,
                                           String actorRoleKey,
                                           String actorUserId,
                                           boolean requireComplete);
}
