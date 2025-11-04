package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Order(1)
public class TransformStepParser implements StepParser {

    @Override
    @SuppressWarnings("unchecked")
    public boolean canParse(Map<String, Object> nodeData) {
        // TRANSFORM nodes have "outputDataPoints" but NOT "routing" at the same level
        // This distinguishes them from TRIGGER nodes
        if (nodeData.containsKey("outputDataPoints")) {
            // Check if this is NOT a TRIGGER node by looking for trigger-specific
            // indicators
            // Triggers usually have no routing or have a simple routing structure
            // Transforms are intermediate processing nodes
            Object outputDataPoints = nodeData.get("outputDataPoints");
            if (outputDataPoints instanceof List) {
                List<Map<String, Object>> outputs = (List<Map<String, Object>>) outputDataPoints;
                // If there's only one output field being computed, it's likely a transform
                // Triggers usually have multiple configuration fields
                if (!outputs.isEmpty()) {
                    // Check if any output has a "compute" expression
                    boolean hasCompute = outputs.stream()
                            .anyMatch(output -> output.containsKey("compute"));

                    // If there's routing, it's more likely a transform than a trigger
                    boolean hasRouting = nodeData.containsKey("routing");

                    // Transform if it has compute expressions and doesn't look like a config node
                    if (hasCompute && (hasRouting || outputs.size() <= 2)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    @Override
    @SuppressWarnings("unchecked")
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        List<Map<String, Object>> outputs = (List<Map<String, Object>>) nodeData.get("outputDataPoints");

        Map<String, Object> transformations = new LinkedHashMap<>();
        StringBuilder descriptionBuilder = new StringBuilder("Transforms data by computing: ");

        if (outputs != null && !outputs.isEmpty()) {
            int count = 0;
            for (Map<String, Object> output : outputs) {
                String fieldName = (String) output.get("fieldName");
                String compute = (String) output.get("compute");

                if (fieldName != null) {
                    String readableKey = AutomationParserService.humanizeIdentifier(fieldName);
                    String cleanedCompute = compute != null ? AutomationParserService.cleanSpel(compute) : "N/A";
                    transformations.put(readableKey, cleanedCompute);

                    if (count > 0)
                        descriptionBuilder.append(", ");
                    descriptionBuilder.append(readableKey);
                    count++;
                }
            }
        }

        String description = transformations.isEmpty()
                ? "Transforms and processes data fields"
                : descriptionBuilder.toString();

        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title("Transform Data")
                .description(description)
                .type("TRANSFORM")
                .details(transformations.isEmpty() ? null : Map.of("Transformations", transformations))
                .build();
    }
}
