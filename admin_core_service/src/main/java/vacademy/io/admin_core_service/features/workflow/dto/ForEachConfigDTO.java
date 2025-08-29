package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;
import java.util.Map;

@Data
public class ForEachConfigDTO {
    private String operation; // QUERY, UPDATE, SEND_MESSAGE, SEND_EMAIL, SEND_WHATSAPP, etc.
    private String eval;
    private String on; // For switch operations
    private Map<String, Object> cases; // For switch operations
    private Object defaultCase; // For switch operations

    // For QUERY operations
    private String prebuiltKey;
    private Map<String, Object> params;

    // For UPDATE operations
    private String updateField;
    private Object updateValue;

    // For message operations
    private String messageType; // EMAIL, WHATSAPP, SMS
    private String template; // Template name or content for message operations
    private Map<String, Object> messageConfig;
}