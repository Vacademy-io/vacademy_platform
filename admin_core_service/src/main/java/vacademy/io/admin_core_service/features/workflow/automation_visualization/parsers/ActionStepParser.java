package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import java.util.Map;

@Component
public class ActionStepParser implements StepParser {
    @Override
    public boolean canParse(Map<String, Object> nodeData) {
        return nodeData.containsKey("forEach") && "SEND_EMAIL".equals(((Map<String,Object>)nodeData.get("forEach")).get("operation"));
    }

    @Override
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title("Send Communication")
                .description("Sends the prepared Email or WhatsApp message to the target learners.")
                .type("EMAIL")
                .build();
    }
}