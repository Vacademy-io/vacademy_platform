package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class QuestionAttemptData {
    private String questionId;
    private Long questionDurationLeftInSeconds;
    private Long timeTakenInSeconds;
    private OptionsJson responseData;


    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OptionsJson{
        private String type;
        private List<String> optionIds = new ArrayList<>();
    }
}
