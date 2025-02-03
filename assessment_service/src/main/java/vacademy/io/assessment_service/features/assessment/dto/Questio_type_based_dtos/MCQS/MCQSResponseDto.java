package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.MCQS;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class MCQSResponseDto {
    private String questionId;
    private int questionDurationLeftInSeconds;
    private int timeTakenInSeconds;
    private ResponseData responseData;

    @Getter
    @Setter
    public static class ResponseData {
        private String type;
        private List<String> optionIds;
    }
}
