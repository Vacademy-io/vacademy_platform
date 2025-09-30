package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;

@Data
public class IteratorConfigDTO {
    private String on;
    private ForEachConfigDTO forEach;
    private String operation; // For backward compatibility
}