package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class QueryProcessorStrategy implements DataProcessorStrategy {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    // You would inject your query service here
    // private final QueryService queryService;

    @Override
    public boolean canHandle(String operation) {
        return "QUERY".equalsIgnoreCase(operation);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> changes = new HashMap<>();

        try {
            JsonNode configNode = objectMapper.convertValue(config, JsonNode.class);

            String prebuiltKey = configNode.path("prebuiltKey").asText();
            if (prebuiltKey.isBlank()) {
                log.warn("QUERY action missing prebuiltKey");
                return changes;
            }

            // Extract parameters and evaluate SPEL expressions
            JsonNode paramsNode = configNode.path("params");
            Map<String, Object> params = new HashMap<>();
            paramsNode.fields().forEachRemaining(e -> {
                Object value = spelEvaluator.eval(e.getValue().asText(), itemContext);
                params.put(e.getKey(), value);
            });

            // Execute the query (you would integrate with your query service here)
            log.info("Executing query with prebuiltKey: {} and params: {}", prebuiltKey, params);

            // For now, we'll just store the query info
            changes.put("query_executed", true);
            changes.put("prebuiltKey", prebuiltKey);
            changes.put("params", params);

            // TODO: Integrate with actual query service
            // Map<String, Object> result = queryService.execute(prebuiltKey, params);
            // if (result != null) {
            // changes.putAll(result);
            // }

        } catch (Exception e) {
            log.error("Error executing Query processor", e);
            changes.put("query_executed", false);
            changes.put("error", e.getMessage());
        }

        return changes;
    }

    @Override
    public String getOperationType() {
        return "QUERY";
    }
}