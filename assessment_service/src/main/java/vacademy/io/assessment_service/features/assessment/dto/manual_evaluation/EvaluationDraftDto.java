package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;

/**
 * Returned by GET /manual-evaluation/get/draft. {@code draftJson} is the opaque
 * editor-state blob the frontend stored; {@code updatedAt} lets the UI show when the
 * draft was last saved ("Restored your draft from …").
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EvaluationDraftDto {
    private String id;
    private String attemptId;
    private String assessmentId;
    private String instituteId;
    private String evaluatorUserId;
    private String draftJson;
    private Date updatedAt;
}
