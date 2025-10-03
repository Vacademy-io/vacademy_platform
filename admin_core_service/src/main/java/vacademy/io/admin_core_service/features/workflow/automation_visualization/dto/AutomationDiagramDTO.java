package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * Represents a complete UML-style activity diagram for a workflow.
 * This is the root object returned by the API.
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutomationDiagramDTO {

    private List<Node> nodes;
    private List<Edge> edges;

    /**
     * Represents a single step (a node) in the diagram.
     */
    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Node {
        private String id;
        private String title;
        private String description;
        private String type; // e.g., "TRIGGER", "ACTION", "DECISION", "EMAIL"
        private Map<String, Object> details; // Rich, human-readable details
    }

    /**
     * Represents a connection (an edge) between two nodes.
     */
    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Edge {
        private String id;
        private String sourceNodeId;
        private String targetNodeId;
        private String label; // e.g., "On Success", "If user is new"
    }
}