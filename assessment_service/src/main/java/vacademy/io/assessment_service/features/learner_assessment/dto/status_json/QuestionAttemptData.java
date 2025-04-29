package vacademy.io.assessment_service.features.learner_assessment.dto.status_json;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class QuestionAttemptData {
    private String questionId;
    private Boolean isMarkedForReview;
    private Boolean isVisited;
    private Long questionDurationLeftInSeconds;
    private Long timeTakenInSeconds;
    private OptionsJson responseData;


    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class OptionsJson {
        private String type;
        private List<String> optionIds = new ArrayList<>();
    }
}
