package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final QueryService queryService;

    @Override
    public boolean supports(String nodeType) {
        return "QUERY".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson) {
        log.info("QueryNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

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

            // Execute query
            JsonNode queryConfig = config.path("query");
            if (!queryConfig.isMissingNode()) {
                String prebuiltKey = queryConfig.path("prebuilt_key").asText("");
                JsonNode params = queryConfig.path("params");

                if (!prebuiltKey.isBlank()) {
                    Map<String, Object> queryParams = new HashMap<>();
                    if (params.isObject()) {
                        params.fieldNames().forEachRemaining(key -> {
                            String valueExpr = params.get(key).asText();
                            if (valueExpr.startsWith("#{") && valueExpr.endsWith("}")) {
                                Object value = spelEvaluator.eval(valueExpr, context);
                                queryParams.put(key, value);
                            } else {
                                queryParams.put(key, valueExpr);
                            }
                        });
                    }

                    log.debug("Executing query with key: {}, params: {}", prebuiltKey, queryParams);
                    Map<String, Object> queryResult = queryService.execute(prebuiltKey, queryParams);
                    changes.putAll(queryResult);
                }
            }

            // Process output data points
            JsonNode outputs = config.path("output_data_points");
            if (outputs.isArray()) {
                for (JsonNode output : outputs) {
                    String fieldName = output.path("field_name").asText("");
                    String creationPolicy = output.path("creation_policy").asText("CREATE");

                    if (fieldName.isBlank())
                        continue;

                    if ("CREATE".equals(creationPolicy) && !changes.containsKey(fieldName)) {
                        // Field should be created but wasn't by query service
                        log.warn("Output field '{}' marked as CREATE but not provided by query service", fieldName);
                    }
                }
            }

        } catch (Exception e) {
            log.error("Error while processing QueryNodeHandler config", e);
            changes.put("error", e.getMessage());
        }

        log.info("Query changes map prepared: {}", changes);
        return changes;
    }

    public interface QueryService {
        Map<String, Object> execute(String prebuiltKey, Map<String, Object> params);
    }
}