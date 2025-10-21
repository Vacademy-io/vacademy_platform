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

        // Create a mutable copy of the context to apply chained transformations
        Map<String, Object> localContext = new HashMap<>(context);

        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);

            // Process output data points with compute expressions
            JsonNode outputs = config.path("outputDataPoints");
            if (outputs.isArray()) {
                for (JsonNode output : outputs) {
                    String fieldName = output.path("fieldName").asText(null);
                    String computeExpr = output.path("compute").asText(null);

                    if (fieldName == null || fieldName.isBlank()) {
                        log.warn("Skipping output data point with missing fieldName.");
                        continue;
                    }

                    if (computeExpr != null && !computeExpr.isBlank()) {
                        // Evaluate compute expression against the *current* state of the local context
                        Object value = spelEvaluator.evaluate(computeExpr, localContext);

                        // Update the local context with the new value for the next iteration
                        localContext.put(fieldName, value);
                        log.debug("Field '{}' transformed via SpEL. New value has been updated in the local context.", fieldName);
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error while processing TransformNodeHandler config", e);
            // Return an error in the context if something goes wrong
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("error", "TransformNodeHandler failed: " + e.getMessage());
            return errorResult;
        }

        // Calculate the net changes to return to the workflow engine
        Map<String, Object> finalChanges = new HashMap<>();
        for (Map.Entry<String, Object> entry : localContext.entrySet()) {
            // Add to changes if the key is new or the value has changed
            if (!context.containsKey(entry.getKey()) || !Objects.equals(context.get(entry.getKey()), entry.getValue())) {
                finalChanges.put(entry.getKey(), entry.getValue());
            }
        }

        log.info("Transform changes map prepared with keys: {}", finalChanges.keySet());
        return finalChanges;
    }
}
