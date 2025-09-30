package vacademy.io.admin_core_service.features.workflow.automation_visualization.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutomationDiagramDto {
    private List<AutomationNodeDto> nodes;
    private List<AutomationEdgeDto> edges;
}
