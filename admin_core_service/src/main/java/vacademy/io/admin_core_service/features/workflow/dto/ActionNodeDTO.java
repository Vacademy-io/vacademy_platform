package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.List;

@Data
public class ActionNodeDTO {
    private String dataProcessor;
    private Object config;
    private JsonNode routing; // Flexible routing that can handle any JSON structure
}
