package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class SwitchProcessorStrategy implements DataProcessorStrategy {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;

    @Override
    public boolean canHandle(String operation) {
        return "SWITCH".equalsIgnoreCase(operation);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> changes = new HashMap<>();

        try {
            ForEachConfigDTO forEachConfig = objectMapper.convertValue(config, ForEachConfigDTO.class);

            // Evaluate the switch expression
            String onExpr = forEachConfig.getOn();
            Object switchValue = spelEvaluator.eval(onExpr, itemContext);
            String key = String.valueOf(switchValue);

            // Find matching case
            Object selectedCase = forEachConfig.getCases().get(key);
            if (selectedCase == null) {
                selectedCase = forEachConfig.getCases().get("default");
                log.debug("No case found for key: {}, using default", key);
            }

            if (selectedCase != null) {
                // Store the selected template/case in context for downstream processing
                changes.put(forEachConfig.getEval(), selectedCase);
                changes.put("switch_key", key);
                log.debug("Switch selected case: {} for key: {}", selectedCase, key);
            }

        } catch (Exception e) {
            log.error("Error executing Switch processor", e);
        }

        return changes;
    }

    @Override
    public String getOperationType() {
        return "SWITCH";
    }
}