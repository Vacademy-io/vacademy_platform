package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TriggerNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        boolean supported = "TRIGGER".equalsIgnoreCase(nodeType);
        log.debug("TriggerNodeHandler.supports(nodeType={}) -> {}", nodeType, supported);
        return supported;
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson) {
        log.info("TriggerNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        Map<String, Object> changes = new HashMap<>();

        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);

            // Parse output_data_points
            JsonNode outputs = config.get("output_data_points");
            if (outputs != null && outputs.isArray()) {
                for (JsonNode output : outputs) {
                    String fieldName = output.path("field_name").asText("");
                    if (fieldName.isBlank()) {
                        continue;
                    }

                    // Prefer dynamic compute (SpEL), fallback to static value
                    String computeExpr = output.path("compute").asText(null);
                    if (computeExpr != null && !computeExpr.isBlank()) {
                        Object value = spelEvaluator.eval(computeExpr, context);
                        changes.put(fieldName, value);
                        log.debug("Field '{}' computed via SpEL to value: {}", fieldName, value);
                        continue;
                    }

                    JsonNode valueNode = output.get("value");
                    if (valueNode != null && !valueNode.isNull()) {
                        Object value = objectMapper.convertValue(valueNode, Object.class);
                        changes.put(fieldName, value);
                        log.debug("Field '{}' set to static value: {}", fieldName, value);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error while processing TriggerNodeHandler config", e);
        }

        log.info("Changes map prepared: {}", changes);
        return changes;
    }
}
