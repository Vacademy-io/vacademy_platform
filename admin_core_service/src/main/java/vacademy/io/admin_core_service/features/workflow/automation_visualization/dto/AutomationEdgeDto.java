package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutomationEdgeDto {
    private String id;
    private String source;
    private String target;
    private String label; // e.g., "If remainingDays = 7"
    private boolean animated;
}