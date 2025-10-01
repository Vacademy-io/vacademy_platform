package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class TriggerStepParser implements StepParser {

    @Override
    public boolean canParse(Map<String, Object> nodeData) {
        return nodeData.containsKey("outputDataPoints");
    }

    @Override
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title("Workflow Trigger")
                .description("The workflow starts here, preparing the initial data.")
                .type("TRIGGER")
                .details(extractTriggerData(nodeData))
                .build();
    }

    private Map<String, Object> extractTriggerData(Map<String, Object> nodeData) {
        Map<String, Object> triggerDetails = new LinkedHashMap<>();
        List<Map<String, Object>> outputs = (List<Map<String, Object>>) nodeData.get("outputDataPoints");

        if (outputs == null) return triggerDetails;

        for (Map<String, Object> point : outputs) {
            String fieldName = (String) point.get("fieldName");
            Object value = point.getOrDefault("compute", point.get("value"));
            String readableKey = AutomationParserService.humanizeIdentifier(fieldName);
            triggerDetails.put(readableKey, AutomationParserService.cleanValue(value));
        }
        return triggerDetails;
    }
}