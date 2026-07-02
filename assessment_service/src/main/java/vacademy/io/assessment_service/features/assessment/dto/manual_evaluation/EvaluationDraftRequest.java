package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Body of POST /manual-evaluation/save/draft. {@code draftJson} is the frontend's
 * serialized evaluator state (annotations/marks/feedback/timer/page) — stored verbatim.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EvaluationDraftRequest {
    private String draftJson;
}
