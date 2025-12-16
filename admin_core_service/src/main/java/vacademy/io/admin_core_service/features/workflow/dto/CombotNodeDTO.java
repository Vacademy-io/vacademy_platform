package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.Map;

@Data
public class CombotNodeDTO {
    private String on; // The SpEL expression to iterate over (e.g., "#ctx['userList']")
    private ForEachConfigDTO forEach; // Logic to extract data for each item
    private JsonNode routing;
}