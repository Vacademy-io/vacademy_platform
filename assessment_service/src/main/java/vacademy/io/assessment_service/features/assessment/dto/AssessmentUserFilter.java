package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssessmentUserFilter {
    private String name;
    private String assessmentType;
    private List<String> attemptType;
    private String registrationSource;
    private List<String> batches;
    private List<String> status;
    private Map<String, String> sortColumns;
}
