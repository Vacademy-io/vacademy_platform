package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SectionJson {
    private String sectionId;
    private Long timeElapsedInSeconds;
    private List<QuestionJson> questions;
}
