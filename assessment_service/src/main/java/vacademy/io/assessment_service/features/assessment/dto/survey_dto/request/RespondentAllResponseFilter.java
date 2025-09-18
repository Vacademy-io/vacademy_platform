package vacademy.io.assessment_service.features.assessment.dto.survey_dto.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RespondentAllResponseFilter {
    private String name;
    private List<String> assessmentIds;
    private List<String> attemptIds;
    private List<String> status;
    Map<String, String> sortColumns;
}
