package vacademy.io.assessment_service.features.assessment.dto.manual_evaluation;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ManualAttemptFilter {
    Map<String, String> sortColumns = new HashMap<>();
    private String name;
    private List<String> evaluationStatus = new ArrayList<>();
}
