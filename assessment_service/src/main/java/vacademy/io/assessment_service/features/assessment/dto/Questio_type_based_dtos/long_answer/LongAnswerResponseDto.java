package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.long_answer;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LongAnswerResponseDto {
    private String questionId;
    private int questionDurationLeftInSeconds;
    private int timeTakenInSeconds;
    private Boolean isMarkedForReview;
    private Boolean isVisited;
    private ResponseData responseData;

    @Getter
    @Setter
    public static class ResponseData {
        private String type;
        private String answer;
    }
}
