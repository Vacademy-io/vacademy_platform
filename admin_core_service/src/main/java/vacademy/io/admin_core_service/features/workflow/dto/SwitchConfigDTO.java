package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;
import java.util.Map;

@Data
public class SwitchConfigDTO {
    private String on;
    private Map<String, Object> cases;
    private Object defaultCase;
}