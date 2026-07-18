package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStep;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingStepInstance;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingStepInstanceDTO {
    private String id;
    private String onboardingInstanceId;
    private String stepId;
    private String stepName;
    private String stepType;
    private String status;
    private Date enteredAt;
    private Date completedAt;
    private String completedByUserId;
    private String skipReason;

    /** Set only for learner-facing responses: whether the CALLER (resolved STUDENT/PARENT role)
     *  can actually act on this step -- false for a create_student-configured step (always
     *  admin-only) or one whose step-level role_access denies this role edit permission. Left
     *  null for admin-facing responses, where it doesn't apply. */
    private Boolean learnerCanAct;

    /** Prefer {@link #fromEntity(OnboardingStepInstance, OnboardingStep)} -- this overload leaves step_name/step_type null. */
    public static OnboardingStepInstanceDTO fromEntity(OnboardingStepInstance instance) {
        return fromEntity(instance, null);
    }

    public static OnboardingStepInstanceDTO fromEntity(OnboardingStepInstance instance, OnboardingStep step) {
        return OnboardingStepInstanceDTO.builder()
                .id(instance.getId())
                .onboardingInstanceId(instance.getOnboardingInstanceId())
                .stepId(instance.getStepId())
                .stepName(step != null ? step.getStepName() : null)
                .stepType(step != null ? step.getStepType() : null)
                .status(instance.getStatus())
                .enteredAt(instance.getEnteredAt())
                .completedAt(instance.getCompletedAt())
                .completedByUserId(instance.getCompletedByUserId())
                .skipReason(instance.getSkipReason())
                .build();
    }
}
