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
    /** Set by LearnerOnboardingController only, and only when the caller isn't the subject
     *  themself (a parent viewing/acting on a linked child's instance) -- lets a parent with
     *  multiple children tell their onboarding cards apart. Null everywhere else. */
    private String subjectFullName;
    /** Set once a "filled by a parent" step resolves the real student -- null until then. */
    private String resolvedSubjectUserId;
    /** Populated by the controller (needs an AuthService lookup) when resolvedSubjectUserId is set. */
    private String resolvedSubjectName;
    private String resolvedSubjectEmail;
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
                .resolvedSubjectUserId(instance.getResolvedSubjectUserId())
                .currentStepId(instance.getCurrentStepId())
                .status(instance.getStatus())
                .startedBy(instance.getStartedBy())
                .startedAt(instance.getStartedAt())
                .completedAt(instance.getCompletedAt())
                .build();
    }
}
