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
public class OneWordLongSurveyDto {
    private String type;
    private Integer totalRespondent;
    private Integer order;
    List<OneWordLongSurveyInfo> latestResponse;


    @Getter
    @Setter
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class OneWordLongSurveyInfo{
        private String name;
        private String email;
        private String answer;
    }
}
