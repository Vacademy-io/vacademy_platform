package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;
import java.util.Map;

@Data
public class ForEachConfigDTO {
    private String operation; // QUERY, UPDATE, SEND_MESSAGE, SEND_EMAIL, SEND_WHATSAPP, ITERATOR, etc.
    private String eval;
    private String on; // For switch operations and nested iterators
    private Map<String, Object> cases; // For switch operations
    private Object defaultCase; // For switch operations
    private String compute;
    // For QUERY operations
    private String prebuiltKey;
    private Map<String, Object> params;
    private String compute;

    // For nested ITERATOR operations
    private ForEachConfigDTO forEach; // This allows nested forEach configurations
}
