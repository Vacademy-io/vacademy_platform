package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.onboarding.entity.OnboardingFlow;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingFlowDTO {
    private String id;
    private String instituteId;
    private String name;
    private String description;
    private String status;
    private String startMode;
    private String createdByUserId;
    private Date createdAt;
    private Date updatedAt;

    private List<OnboardingStepDTO> steps;

    public static OnboardingFlowDTO fromEntity(OnboardingFlow flow) {
        return OnboardingFlowDTO.builder()
                .id(flow.getId())
                .instituteId(flow.getInstituteId())
                .name(flow.getName())
                .description(flow.getDescription())
                .status(flow.getStatus())
                .startMode(flow.getStartMode())
                .createdByUserId(flow.getCreatedByUserId())
                .createdAt(flow.getCreatedAt())
                .updatedAt(flow.getUpdatedAt())
                .build();
    }
}
