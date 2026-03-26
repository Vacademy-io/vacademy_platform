package vacademy.io.admin_core_service.features.workflow.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ContextSchemaRequestDTO {
    private String targetNodeId;
    private List<UpstreamNode> upstreamNodes;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpstreamNode {
        private String nodeId;
        private String nodeName;
        private String nodeType;
        private Map<String, Object> config;
    }
}
