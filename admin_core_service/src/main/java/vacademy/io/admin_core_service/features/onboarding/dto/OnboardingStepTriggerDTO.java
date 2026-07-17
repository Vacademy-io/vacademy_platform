package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One workflow trigger attached to an onboarding step: a workflow that fires when a subject
 * enters/completes/skips this step (workflow_trigger row with eventId = the step's id).
 * {@code workflow_name} is populated on read; ignored on save.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingStepTriggerDTO {
    private String triggerEventName; // ONBOARDING_STEP_ENTERED | _COMPLETED | _SKIPPED
    private String workflowId;
    private String workflowName;
}
