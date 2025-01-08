package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.assessment_service.features.assessment.service.StepOption;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StepResponseDto {
    private String stepName;
    private String status;
    private String instituteId;
    private String type;
    private Map<String, Object> savedData = new HashMap<>();
    private List<Map<String, String>> stepKeys = new ArrayList<>();
    private Map<String, StepOption> defaultValues = new HashMap<>();
    private Map<String, List<StepOption>> fieldOptions = new HashMap<>();
}
