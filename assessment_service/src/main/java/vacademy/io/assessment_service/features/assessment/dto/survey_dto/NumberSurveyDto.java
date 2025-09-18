package vacademy.io.assessment_service.features.assessment.dto.survey_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Builder
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class NumberSurveyDto {
    private String type;
    private Integer totalRespondent;
    private Integer order;
    private List<NumberSurveyInfo> numberSurveyInfoList;


    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class NumberSurveyInfo{
        private String answer;
        private Integer totalResponses;
    }
}
