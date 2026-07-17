package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingInstance;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingInstanceDTO {
    private String id;
    private String flowId;
    private String instituteId;
    private String subjectUserId;
    private String currentStepId;
    private String status;
    private String startedBy;
    private Date startedAt;
    private Date completedAt;

    private List<OnboardingStepInstanceDTO> stepInstances;

    public static OnboardingInstanceDTO fromEntity(OnboardingInstance instance) {
        return OnboardingInstanceDTO.builder()
                .id(instance.getId())
                .flowId(instance.getFlowId())
                .instituteId(instance.getInstituteId())
                .subjectUserId(instance.getSubjectUserId())
                .currentStepId(instance.getCurrentStepId())
                .status(instance.getStatus())
                .startedBy(instance.getStartedBy())
                .startedAt(instance.getStartedAt())
                .completedAt(instance.getCompletedAt())
                .build();
    }
}
