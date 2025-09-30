package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.workflow.dto.RoutingDTO;
import vacademy.io.admin_core_service.features.workflow.dto.TriggerNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
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
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        log.info("TriggerNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        Map<String, Object> changes = new HashMap<>();
        try {
            TriggerNodeDTO config = objectMapper.readValue(nodeConfigJson, TriggerNodeDTO.class);

            if (config.getOutputDataPoints() != null) {
                for (TriggerNodeDTO.OutputDataPoint output : config.getOutputDataPoints()) {
                    String fieldName = output.getFieldName();
                    if (fieldName == null || fieldName.isBlank())
                        continue;

                    if (output.getCompute() != null && !output.getCompute().isBlank()) {
                        Object value = spelEvaluator.evaluate(output.getCompute(), context);
                        changes.put(fieldName, value);
                        log.debug("Field '{}' computed via SpEL to value: {}", fieldName, value);
                    } else if (output.getValue() != null) {
                        changes.put(fieldName, output.getValue());
                        log.debug("Field '{}' set to static value: {}", fieldName, output.getValue());
                    }
                }
            }

            // Store routing info in context for the main workflow engine to handle


        } catch (Exception e) {
            log.error("Error while processing TriggerNodeHandler config", e);
        }

        log.info("Changes map prepared: {}", changes);
        return changes;
    }
}
