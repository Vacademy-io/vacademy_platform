package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class SendWhatsAppNodeDTO {
    private String on; // List to iterate over
    private ForEachConfigDTO forEach; // Configuration for each item
    private String languageCode;
    private Map<String, Object> headerParams;
    private String headerType;
    private JsonNode routing; // Flexible routing that can handle any JSON structure
}