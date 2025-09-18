package vacademy.io.assessment_service.features.assessment.dto.survey_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MCQSurveyDto {
    private String type;
    private Integer totalRespondent;
    private Integer order;
    private List<MCQSurveyInfo> mcqSurveyInfoList;

    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class MCQSurveyInfo{
        private String option;
        private Double percentage;
        private Integer respondentCount;
    }
}
