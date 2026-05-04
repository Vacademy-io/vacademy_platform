package vacademy.io.assessment_service.features.assessment.dto.Questio_type_based_dtos.coding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CodingCorrectAnswerDto {
    private String type;
    private DataFields data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DataFields {
        private String problemHtml;
        private List<String> allowedLanguages;
        private Map<String, String> starterCode;
        private List<TestCase> testCases;
        private PerRunLimits perRunLimits;
        private Integer maxPoints;
        private Integer sessionTimeMinutes;
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TestCase {
        private String id;
        private String label;
        private String stdin;
        private String expectedStdout;
        private Boolean visible;
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
