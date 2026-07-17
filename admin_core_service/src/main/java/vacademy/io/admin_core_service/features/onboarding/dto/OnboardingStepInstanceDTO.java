package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
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

    public static OnboardingStepInstanceDTO fromEntity(OnboardingStepInstance instance) {
        return OnboardingStepInstanceDTO.builder()
                .id(instance.getId())
                .onboardingInstanceId(instance.getOnboardingInstanceId())
                .stepId(instance.getStepId())
                .status(instance.getStatus())
                .enteredAt(instance.getEnteredAt())
                .completedAt(instance.getCompletedAt())
                .completedByUserId(instance.getCompletedByUserId())
                .skipReason(instance.getSkipReason())
                .build();
    }
}
