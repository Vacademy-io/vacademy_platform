package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TriggerNodeDTO {
    private String triggerEvent;
    private List<OutputDataPoint> outputDataPoints;
    private JsonNode routing;

    @Data
    public static class OutputDataPoint {
        private String fieldName;
        private String compute;
        private Object value;
    }
}
