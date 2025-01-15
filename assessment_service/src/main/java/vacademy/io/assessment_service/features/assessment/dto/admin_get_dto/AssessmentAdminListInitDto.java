package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

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
public class AssessmentAdminListInitDto {
    private List<String> assessmentAccessStatuses;
    private List<String> assessmentModeTypes;
    private List<String> evaluationTypes;
    private Map<String, String> tagAndIds;
}
