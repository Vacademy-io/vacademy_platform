package vacademy.io.assessment_service.features.question_core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
@NoArgsConstructor
public class CodingEvaluationDTO {
    private String type;
    private CodingEvaluationData data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CodingEvaluationData {
        private String problemHtml;
        private List<String> allowedLanguages;
        private Map<String, String> starterCode;
        private List<CodingTestCaseDTO> testCases;
        private PerRunLimits perRunLimits;
        private Integer maxPoints;
        private Integer sessionTimeMinutes;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PerRunLimits {
        private Integer cpuSeconds;
        private Integer memoryKb;
    }
}
