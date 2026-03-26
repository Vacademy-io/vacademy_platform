package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConditionNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean supports(String nodeType) {
        return "CONDITION".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            String conditionExpr = config.path("condition").asText("");

            if (conditionExpr.isBlank()) {
                log.warn("CONDITION node: missing condition expression");
                result.put("error", "Missing condition expression");
                result.put("conditionResult", false);
                return result;
            }

            Object evalResult = spelEvaluator.evaluate(conditionExpr, context);
            boolean conditionResult = evalResult instanceof Boolean ? (Boolean) evalResult :
                    Boolean.parseBoolean(String.valueOf(evalResult));

            log.info("CONDITION node: '{}' evaluated to {}", conditionExpr, conditionResult);
            result.put("conditionResult", conditionResult);

            // Store in context for routing decisions
            context.put("conditionResult", conditionResult);

        } catch (Exception e) {
            log.error("Error in ConditionNodeHandler", e);
            result.put("error", "ConditionNodeHandler error: " + e.getMessage());
            result.put("conditionResult", false);
            context.put("conditionResult", false);
        }
        return result;
    }
}
