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
    private String questionName;
    private List<ReportOptionsDto> studentResponseOptions;
    private List<ReportOptionsDto> correctOptions;
    private String explanationId;
    private String explanation;
    private double mark;
    private Long timeTakenInSeconds;
    private String answerStatus;


    @Builder
    @Getter
    @Setter
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ReportOptionsDto {
        private String optionId;
        private String optionName;
    }
}
