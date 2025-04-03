package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.one_word;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OneWordResponseDto {
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
