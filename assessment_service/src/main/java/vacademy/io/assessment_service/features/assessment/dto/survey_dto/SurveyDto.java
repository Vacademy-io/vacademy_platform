package vacademy.io.assessment_service.features.assessment.dto.survey_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;

import java.util.List;

@Getter
@Setter
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SurveyDto {
    AssessmentQuestionPreviewDto assessmentQuestionPreviewDto;
    List<MCQSurveyDto> mcqSurveyDtos;
    List<OneWordLongSurveyDto> oneWordLongSurveyDtos;
    List<NumberSurveyDto> numberSurveyDtos;
}
