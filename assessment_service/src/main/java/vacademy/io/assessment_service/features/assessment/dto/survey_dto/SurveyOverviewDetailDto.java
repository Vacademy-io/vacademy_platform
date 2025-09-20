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
public class SurveyOverviewDetailDto {
    private String surveyId;
    private Long totalParticipants;
    private Long participantsResponded;
    List<SurveyDto> allSurveys;


}
