package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import java.util.Map;

public interface StepParser {
    boolean canParse(Map<String, Object> nodeData);
    AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData);
}