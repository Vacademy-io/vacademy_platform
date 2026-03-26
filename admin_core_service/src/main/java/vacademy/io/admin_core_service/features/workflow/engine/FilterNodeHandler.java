package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class FilterNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        return "FILTER".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            String sourceExpr = config.path("source").asText("");
            String conditionExpr = config.path("condition").asText("");
            String outputKey = config.path("outputKey").asText("filteredList");

            if (sourceExpr.isBlank() || conditionExpr.isBlank()) {
                log.warn("FILTER node: missing source or condition expression");
                result.put("error", "Missing source or condition expression");
                return result;
            }

            // Evaluate source to get the list
            Object sourceObj = spelEvaluator.evaluate(sourceExpr, context);
            if (!(sourceObj instanceof Collection)) {
                log.warn("FILTER node: source expression did not return a collection: {}", sourceExpr);
                result.put("error", "Source expression must return a collection");
                return result;
            }

            Collection<?> sourceList = (Collection<?>) sourceObj;
            List<Object> filtered = new ArrayList<>();

            for (Object item : sourceList) {
                // Create per-item context with #item variable
                Map<String, Object> itemContext = new HashMap<>(context);
                itemContext.put("item", item);

                try {
                    Object condResult = spelEvaluator.evaluate(conditionExpr, itemContext);
                    boolean passes = condResult instanceof Boolean ? (Boolean) condResult :
                            Boolean.parseBoolean(String.valueOf(condResult));
                    if (passes) {
                        filtered.add(item);
                    }
                } catch (Exception e) {
                    log.debug("FILTER condition failed for item, skipping: {}", e.getMessage());
                }
            }

            log.info("FILTER node: {} of {} items passed condition '{}'", filtered.size(), sourceList.size(), conditionExpr);
            result.put(outputKey, filtered);
            result.put("filteredCount", filtered.size());
            result.put("totalCount", sourceList.size());

        } catch (Exception e) {
            log.error("Error in FilterNodeHandler", e);
            result.put("error", "FilterNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
