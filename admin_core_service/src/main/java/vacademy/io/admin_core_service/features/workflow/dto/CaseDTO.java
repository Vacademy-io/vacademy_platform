package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;

@Data
public class CaseDTO {
    private String value;
    private String targetNodeId;
}