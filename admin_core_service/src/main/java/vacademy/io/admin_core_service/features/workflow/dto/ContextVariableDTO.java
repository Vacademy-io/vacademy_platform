package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ContextVariableDTO {
    private String key;
    private String type;           // e.g., "List<Map>", "String", "Boolean", "Number"
    private String sourceNodeId;
    private String sourceNodeName;
    private String sourceNodeType;
    private String description;
    private String spelExpression;  // e.g., "#ctx['userList']"
}
