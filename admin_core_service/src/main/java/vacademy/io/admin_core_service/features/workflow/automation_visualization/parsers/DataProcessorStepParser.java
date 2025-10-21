package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class DataProcessorStepParser implements StepParser {

    @Override
    public boolean canParse(Map<String, Object> nodeData) {
        return nodeData.containsKey("dataProcessor");
    }

    @Override
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        Map<String, Object> config = (Map<String, Object>) nodeData.get("config");
        Map<String, Object> forEach = (Map<String, Object>) config.get("forEach");
        String on = AutomationParserService.cleanSpel((String) config.get("on"));
        String operation = (String) forEach.get("operation");

        if ("SWITCH".equals(operation)) {
            String switchOn = AutomationParserService.cleanSpel((String) forEach.get("on"));
            String description = "For each item in '" + on + "', a decision is made based on the value of '" + switchOn + "'.";
            return AutomationDiagramDTO.Node.builder()
                    .id(nodeId)
                    .title("Decision: On " + AutomationParserService.humanizeIdentifier(switchOn))
                    .description(description)
                    .type("DECISION")
                    .details(extractLogicDetails(forEach))
                    .build();
        }

        String title = "Process Data";
        String description = "Iterates over the '" + on + "' list to process each item.";
        if ("QUERY".equals(operation)) {
            String key = (String) forEach.get("prebuiltKey");
            title = "Loop and " + AutomationParserService.TERMINOLOGY_MAP.getOrDefault(key, AutomationParserService.humanizeIdentifier(key));
        } else if ("ITERATOR".equals(operation)) {
            // Handle nested iterators
            Map<String, Object> innerForEach = (Map<String, Object>) forEach.get("forEach");
            String innerOn = AutomationParserService.cleanSpel((String) forEach.get("on"));
            String innerKey = (String) innerForEach.get("prebuiltKey");
            title = "Nested Loop: " + AutomationParserService.TERMINOLOGY_MAP.getOrDefault(innerKey, AutomationParserService.humanizeIdentifier(innerKey));
            description = "For each item in '" + on + "', loop through '" + innerOn + "' and perform the action.";
        }


        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title(title)
                .description(description)
                .type("ACTION")
                .build();
    }

    /**
     * This method is now robust and handles different value types in the 'cases' map.
     */
    private Map<String, Object> extractLogicDetails(Map<String, Object> forEach) {
        Map<String, Object> details = new LinkedHashMap<>();
        String eval = (String) forEach.get("eval");
        if (eval == null) return details;

        List<Map<String, String>> rules = new ArrayList<>();
        Map<String, Object> cases = (Map<String, Object>) forEach.get("cases");

        if (cases == null) return details;

        cases.forEach((key, value) -> {
            Map<String, String> rule = new LinkedHashMap<>();
            rule.put("condition", "If value is '" + key + "'");

            if (value instanceof List && !((List)value).isEmpty() && ((List)value).get(0) instanceof Map) {
                // This handles the rich email/template case
                Map<String, String> action = (Map<String, String>) ((List)value).get(0);
                if (action.containsKey("subject")) {
                    rule.put("Subject", action.get("subject").replaceAll("'", ""));
                }
                if (action.containsKey("body")) {
                    rule.put("Body", AutomationParserService.cleanValue(action.get("body")).toString());
                }
                if (action.containsKey("templateName")) {
                    rule.put("template", action.get("templateName"));
                    rule.put("placeholders", AutomationParserService.cleanValue(action.get("placeholders")).toString());
                }
            } else if (value instanceof Integer || value instanceof String) {
                // This handles the simple value assignment case (e.g., setting sessionInd)
                rule.put("action", "Set '" + eval + "' to '" + value + "'");
            }
            rules.add(rule);
        });

        details.put(AutomationParserService.humanizeIdentifier(eval) + " Rules", rules);
        return details;
    }
}