package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@Order(2)
public class HttpRequestStepParser implements StepParser {

    @Override
    @SuppressWarnings("unchecked")
    public boolean canParse(Map<String, Object> nodeData) {
        // HTTP_REQUEST nodes have a "config" map with "url" or "method" fields
        if (nodeData.containsKey("config")) {
            Object config = nodeData.get("config");
            if (config instanceof Map) {
                Map<String, Object> configMap = (Map<String, Object>) config;
                return configMap.containsKey("url") || configMap.containsKey("method");
            }
        }
        return false;
    }

    @Override
    @SuppressWarnings("unchecked")
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        Map<String, Object> config = (Map<String, Object>) nodeData.get("config");

        String url = (String) config.get("url");
        String method = (String) config.getOrDefault("method", "GET");
        String requestType = (String) config.getOrDefault("requestType", "EXTERNAL");

        // Clean the URL for display
        String cleanUrl = url != null ? AutomationParserService.cleanSpel(url) : "N/A";

        // Build a descriptive title
        String title = method.toUpperCase() + " Request";
        if (cleanUrl.contains("findUserByEmail")) {
            title = "Find User";
        } else if (cleanUrl.contains("createUser") || cleanUrl.contains("/users") && "POST".equalsIgnoreCase(method)) {
            title = "Create User";
        } else if (cleanUrl.contains("enrollUser") || cleanUrl.contains("/enroll")) {
            title = "Enroll User in Course";
        } else if (cleanUrl.contains("courses") || cleanUrl.contains("/wp-json")) {
            title = "Get Course Details";
        }

        String description = String.format("Performs an HTTP %s request to %s",
                method, requestType.equalsIgnoreCase("EXTERNAL") ? "external API" : "internal service");

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Method", method);
        details.put("URL", cleanUrl);
        details.put("Request Type", requestType);

        if (config.containsKey("headers")) {
            details.put("Headers", AutomationParserService.cleanValue(config.get("headers")));
        }

        if (config.containsKey("body")) {
            details.put("Request Body", AutomationParserService.cleanValue(config.get("body")));
        }

        String resultKey = (String) nodeData.getOrDefault("resultKey", "httpResult");
        details.put("Result Stored In", AutomationParserService.cleanSpel(resultKey));

        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title(title)
                .description(description)
                .type("HTTP_REQUEST")
                .details(details)
                .build();
    }
}
