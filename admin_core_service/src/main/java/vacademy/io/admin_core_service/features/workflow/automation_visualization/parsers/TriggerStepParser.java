package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Order(10)
public class TriggerStepParser implements StepParser {

    @Override
    @SuppressWarnings("unchecked")
    public boolean canParse(Map<String, Object> nodeData) {
        // TRIGGER nodes have "outputDataPoints" and typically multiple configuration
        // fields
        // They should NOT have routing (transforms have routing), and should have more
        // than 2 output points
        if (nodeData.containsKey("outputDataPoints")) {
            Object outputDataPoints = nodeData.get("outputDataPoints");
            if (outputDataPoints instanceof List) {
                List<Map<String, Object>> outputs = (List<Map<String, Object>>) outputDataPoints;
                // Triggers typically have many config fields and NO routing
                // or they have "value" fields rather than "compute"
                if (outputs.size() > 2 && !nodeData.containsKey("routing")) {
                    return true;
                }
                // Also check if outputs have "value" instead of "compute" (config-style)
                boolean hasValue = outputs.stream()
                        .anyMatch(output -> output.containsKey("value") && !output.containsKey("compute"));
                if (hasValue) {
                    return true;
                }
            }
        }
        return false;
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractTriggerData(Map<String, Object> nodeData) {
        Map<String, Object> triggerDetails = new LinkedHashMap<>();
        List<Map<String, Object>> outputs = (List<Map<String, Object>>) nodeData.get("outputDataPoints");

        if (outputs == null)
            return triggerDetails;

        for (Map<String, Object> point : outputs) {
            String fieldName = (String) point.get("fieldName");
            Object value = point.getOrDefault("compute", point.get("value"));
            String readableKey = AutomationParserService.humanizeIdentifier(fieldName);
            triggerDetails.put(readableKey, AutomationParserService.cleanValue(value));
        }
        return triggerDetails;
    }
}