package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.Map;

@Data
public class QueryNodeDTO {
    private String prebuiltKey;
    private Map<String, Object> params;
    private JsonNode routing; // Flexible routing that can handle any JSON structure
}
