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
public class LoopNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private static final int MAX_ITERATIONS = 1000;

    @Override
    public boolean supports(String nodeType) {
        return "LOOP".equalsIgnoreCase(nodeType);
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
            String itemVariable = config.path("itemVariable").asText("item");
            String outputKey = config.path("outputKey").asText("loopResults");

            if (sourceExpr.isBlank()) {
                result.put("error", "Missing source expression");
                return result;
            }

            Object sourceObj = spelEvaluator.evaluate(sourceExpr, context);
            if (!(sourceObj instanceof Collection)) {
                result.put("error", "Source expression must return a collection");
                return result;
            }

            Collection<?> sourceList = (Collection<?>) sourceObj;
            if (sourceList.size() > MAX_ITERATIONS) {
                log.warn("LOOP node: source has {} items, exceeding max {}. Truncating.", sourceList.size(), MAX_ITERATIONS);
            }

            List<Object> loopResults = new ArrayList<>();
            int iteration = 0;
            int successCount = 0;
            int failCount = 0;

            for (Object item : sourceList) {
                if (iteration >= MAX_ITERATIONS) {
                    log.warn("LOOP node: max iterations ({}) reached, stopping", MAX_ITERATIONS);
                    break;
                }

                // Set the current item in context for downstream nodes
                context.put(itemVariable, item);
                context.put("loopIndex", iteration);
                context.put("loopSize", sourceList.size());

                // The LOOP node itself just prepares iteration context.
                // The actual body execution is handled by the engine's routing.
                // We collect the item as processed.
                loopResults.add(item);
                successCount++;
                iteration++;
            }

            result.put(outputKey, loopResults);
            result.put("iterationCount", iteration);
            result.put("successCount", successCount);
            result.put("failCount", failCount);

            // Store the full list in context for downstream access
            context.put(outputKey, loopResults);
            context.put("loopIterationCount", iteration);

            log.info("LOOP node: processed {} iterations over {} items", iteration, sourceList.size());

        } catch (Exception e) {
            log.error("Error in LoopNodeHandler", e);
            result.put("error", "LoopNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
