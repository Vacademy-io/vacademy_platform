package vacademy.io.admin_core_service.features.onboarding.service;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;

import java.util.HashMap;
import java.util.Map;

/**
 * Assembles the context map emitted with onboarding workflow triggers
 * (ONBOARDING_FLOW_STARTED/_COMPLETED, ONBOARDING_STEP_ENTERED/_COMPLETED/_SKIPPED),
 * following the same shape as {@code LeadTriggerContextBuilder} so downstream
 * SEND_EMAIL/SEND_WHATSAPP nodes can resolve variables consistently.
 */
@Component
public class OnboardingTriggerContextBuilder {

    public Map<String, Object> forStepChange(OnboardingInstance instance, OnboardingStep step, String changeType) {
        Map<String, Object> ctx = new HashMap<>();
        put(ctx, "instituteId", instance.getInstituteId());
        put(ctx, "subjectUserId", instance.getSubjectUserId());
        put(ctx, "onboardingInstanceId", instance.getId());
        put(ctx, "flowId", instance.getFlowId());
        put(ctx, "stepId", step.getId());
        put(ctx, "stepName", step.getStepName());
        put(ctx, "changeType", changeType);
        return ctx;
    }

    public Map<String, Object> forFlowChange(OnboardingInstance instance, String changeType) {
        Map<String, Object> ctx = new HashMap<>();
        put(ctx, "instituteId", instance.getInstituteId());
        put(ctx, "subjectUserId", instance.getSubjectUserId());
        put(ctx, "onboardingInstanceId", instance.getId());
        put(ctx, "flowId", instance.getFlowId());
        put(ctx, "changeType", changeType);
        return ctx;
    }

    private void put(Map<String, Object> ctx, String key, Object value) {
        if (value != null) ctx.put(key, value);
    }
}
