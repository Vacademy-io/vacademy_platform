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
public class IndividualResponseRequestFilter {
    private String name;
    private List<String> assessmentIds;
    private List<String> questionIds;
    private List<String> sectionIds;
    private List<String> status;
    private Map<String, String> sortColumns;
}
