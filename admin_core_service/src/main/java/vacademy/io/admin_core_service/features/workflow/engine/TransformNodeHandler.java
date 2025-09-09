package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransformNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        return "TRANSFORM".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        log.info("TransformNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        Map<String, Object> changes = new HashMap<>();

        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);

            // Validate input data points
            JsonNode inputs = config.path("input_data_points");
            if (inputs.isArray()) {
                for (JsonNode input : inputs) {
                    String fieldName = input.path("field_name").asText("");
                    boolean isRequired = input.path("is_required").asBoolean(true);

                    if (isRequired && !context.containsKey(fieldName)) {
                        log.error("Required input field '{}' not found in context", fieldName);
                        return Map.of("error", "Required input field '" + fieldName + "' not found");
                    }
                }
            }

            // Process output data points with compute expressions
            JsonNode outputs = config.path("output_data_points");
            if (outputs.isArray()) {
                for (JsonNode output : outputs) {
                    String fieldName = output.path("field_name").asText("");
                    String creationPolicy = output.path("creation_policy").asText("CREATE");
                    String computeExpr = output.path("compute").asText(null);

                    if (fieldName.isBlank())
                        continue;

                    if (computeExpr != null && !computeExpr.isBlank()) {
                        // Evaluate compute expression
                        Object value = spelEvaluator.evaluate(computeExpr, context);
                        changes.put(fieldName, value);
                        log.debug("Field '{}' computed via SpEL to value: {}", fieldName, value);
                    } else if ("CREATE".equals(creationPolicy)) {
                        log.warn("Output field '{}' marked as CREATE but no compute expression provided", fieldName);
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error while processing TransformNodeHandler config", e);
            changes.put("error", e.getMessage());
        }

        log.info("Transform changes map prepared: {}", changes);
        return changes;
    }
}