package vacademy.io.admin_core_service.features.onboarding.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * One row of the onboarding management dashboard -- an instance enriched with the names the
 * raw {@code onboarding_instance} row can't carry itself (subject, flow, current step), so the
 * admin can tell at a glance who's stuck where without opening each subject's side-view.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OnboardingInstanceSummaryDTO {
    private String id;
    private String flowId;
    private String flowName;
    private String subjectUserId;
    private String subjectName;
    private String subjectEmail;
    /** Set once a "filled by a parent" step resolved the real student -- null until then. */
    private String resolvedSubjectName;
    private String currentStepId;
    private String currentStepName;
    private String status;
    private String startedBy;
    private Date startedAt;
    private Date completedAt;
}
