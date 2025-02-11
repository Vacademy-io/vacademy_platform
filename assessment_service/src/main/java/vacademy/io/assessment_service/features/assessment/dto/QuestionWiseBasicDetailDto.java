package vacademy.io.assessment_service.features.assessment.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class QuestionWiseBasicDetailDto {
    private double marks;
    private String answerStatus;
}
