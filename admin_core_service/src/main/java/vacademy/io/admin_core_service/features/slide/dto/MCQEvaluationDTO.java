package vacademy.io.admin_core_service.features.slide.dto;

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
public class MCQEvaluationDTO {
    private String type;
    private MCQData data;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MCQData {
        private List<String> correctOptionIds;
    }
}
