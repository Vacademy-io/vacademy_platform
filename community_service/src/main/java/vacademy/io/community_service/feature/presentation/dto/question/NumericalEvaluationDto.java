package vacademy.io.community_service.feature.presentation.dto.question;

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
        private List<Double> validAnswers;  // Stores integer, 1 decimal, 2 decimals, or negative numbers
    }
}

