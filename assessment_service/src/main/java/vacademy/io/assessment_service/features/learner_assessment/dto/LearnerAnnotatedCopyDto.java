package vacademy.io.assessment_service.features.learner_assessment.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Everything the learner app needs to render the AI-annotated copy over the
 * student's own submitted answer sheet: the OCR layout map (line/region boxes
 * per page) and the flattened list of annotations (tick/cross/circle/margin
 * note anchored to a line_id). The submitted PDF URL is resolved FE-side from
 * the report detail the app already loads.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerAnnotatedCopyDto {
    private JsonNode layoutMap;
    private List<JsonNode> annotations;
}
