package vacademy.io.assessment_service.features.assessment.dto.survey_dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RespondentResponseDto {
    private String question;
    private String questionType;
    private String response;
    private String name;
    private String email;
}
