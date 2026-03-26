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
public class AggregateNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        return "AGGREGATE".equalsIgnoreCase(nodeType);
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

            if (sourceExpr.isBlank()) {
                result.put("error", "Missing source expression");
                return result;
            }

            Object sourceObj = spelEvaluator.evaluate(sourceExpr, context);
            if (!(sourceObj instanceof Collection)) {
                result.put("error", "Source must be a collection");
                return result;
            }

            Collection<?> sourceList = (Collection<?>) sourceObj;
            JsonNode operations = config.path("operations");

            if (!operations.isArray()) {
                result.put("error", "Operations must be an array");
                return result;
            }

            for (JsonNode op : operations) {
                String type = op.path("type").asText("").toUpperCase();
                String field = op.path("field").asText("");
                String outputKey = op.path("outputKey").asText(type.toLowerCase());

                switch (type) {
                    case "COUNT" -> {
                        result.put(outputKey, sourceList.size());
                    }
                    case "SUM" -> {
                        double sum = extractNumbers(sourceList, field).stream()
                                .mapToDouble(Double::doubleValue).sum();
                        result.put(outputKey, sum);
                    }
                    case "AVG" -> {
                        List<Double> numbers = extractNumbers(sourceList, field);
                        double avg = numbers.isEmpty() ? 0.0 :
                                numbers.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                        result.put(outputKey, avg);
                    }
                    case "MIN" -> {
                        List<Double> numbers = extractNumbers(sourceList, field);
                        double min = numbers.stream().mapToDouble(Double::doubleValue).min().orElse(0.0);
                        result.put(outputKey, min);
                    }
                    case "MAX" -> {
                        List<Double> numbers = extractNumbers(sourceList, field);
                        double max = numbers.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
                        result.put(outputKey, max);
                    }
                    default -> log.warn("AGGREGATE: unknown operation type: {}", type);
                }
            }

            log.info("AGGREGATE node: computed {} operations over {} items", operations.size(), sourceList.size());

        } catch (Exception e) {
            log.error("Error in AggregateNodeHandler", e);
            result.put("error", "AggregateNodeHandler error: " + e.getMessage());
        }
        return result;
    }

    private List<Double> extractNumbers(Collection<?> items, String field) {
        List<Double> numbers = new ArrayList<>();
        for (Object item : items) {
            try {
                if (item instanceof Map) {
                    Object val = ((Map<?, ?>) item).get(field);
                    if (val instanceof Number) {
                        numbers.add(((Number) val).doubleValue());
                    }
                } else if (item instanceof Number) {
                    numbers.add(((Number) item).doubleValue());
                }
            } catch (Exception e) {
                log.debug("Failed to extract number from item for field '{}': {}", field, e.getMessage());
            }
        }
        return numbers;
    }
}
