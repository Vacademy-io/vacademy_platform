package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

@Data
public class SendEmailNodeDTO {
    private String on; // List to iterate over
    private ForEachConfigDTO forEach; // Configuration for each item
    private JsonNode routing; // Flexible routing that can handle any JSON structure
}