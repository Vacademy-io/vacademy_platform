package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutomationNodeDto {
    private String id; // e.g., "node_1"
    private String type; // e.g., "trigger", "action", "logic"
    private String label; // Human-readable title, e.g., "Find Learners"
    private String description; // Detailed explanation
    private Map<String, Object> details; // Simplified data for the frontend
    private Position position;

    @Data
    @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Position {
        private int x;
        private int y;
    }
}