package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Builder
@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentReportAnswerReviewDto {
    private String questionId;
    private List<String> studentResponseOptionsIds;
    private double mark;
    private Long timeTakenInSeconds;
    private String answerStatus;
}
