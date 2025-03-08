package vacademy.io.assessment_service.features.question_core.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@AllArgsConstructor
@NoArgsConstructor
public class NumericalEvaluationDto {
    private String type; // Type of evaluation (e.g., "NUMERIC")
    private NumericalData data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class NumericalData {
        private List<String> validAnswers;  // Stores integer, 1 decimal, 2 decimals, or negative numbers
    }

//    public enum NumericalType {
//        INTEGER,         // e.g., 5, -3
//        ONE_DECIMAL,     // e.g., 3.1, -2.5
//        TWO_DECIMAL,     // e.g., 4.25, -1.75
//        ANY_DECIMAL      // e.g., 3.1415, -2.999
//    }
}

