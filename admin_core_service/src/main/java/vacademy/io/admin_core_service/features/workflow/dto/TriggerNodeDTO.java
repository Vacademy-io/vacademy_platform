package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.List;

@Data
public class TriggerNodeDTO {
    private List<OutputDataPoint> outputDataPoints;
    private JsonNode routing; // Flexible routing that can handle any JSON structure

    @Data
    public static class OutputDataPoint {
        private String fieldName;
        private String compute;
        private Object value;
    }
}
