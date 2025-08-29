package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.ActionNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategyRegistry;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class ActionNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final DataProcessorStrategyRegistry strategyRegistry;

    @Override
    public boolean supports(String nodeType) {
        return "ACTION".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(
            Map<String, Object> context,
            String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates,
            int countProcessed) {

        Map<String, Object> changes = new HashMap<>();
        try {
            ActionNodeDTO actionNodeDTO = objectMapper.readValue(nodeConfigJson, ActionNodeDTO.class);

            String dataProcessor = actionNodeDTO.getDataProcessor();
            if (dataProcessor == null || dataProcessor.isBlank()) {
                log.warn("ActionNode missing dataProcessor");
                return changes;
            }

            // Get the appropriate strategy for this data processor
            DataProcessorStrategy strategy = strategyRegistry.getStrategy(dataProcessor);
            if (strategy == null) {
                log.warn("No strategy found for dataProcessor: {}", dataProcessor);
                changes.put("error", "No strategy found for: " + dataProcessor);
                return changes;
            }

            // Execute the strategy
            Object config = actionNodeDTO.getConfig();
            Map<String, Object> itemContext = new HashMap<>(context);

            Map<String, Object> result = strategy.execute(context, config, itemContext);
            if (result != null) {
                changes.putAll(result);
            }

            log.info("Successfully executed {} strategy", dataProcessor);

        } catch (Exception e) {
            log.error("Error handling ActionNode", e);
            changes.put("error", e.getMessage());
        }
        return changes;
    }
}
