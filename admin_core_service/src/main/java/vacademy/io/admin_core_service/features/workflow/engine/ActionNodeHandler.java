package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.dto.ActionNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategy;
import vacademy.io.admin_core_service.features.workflow.engine.action.DataProcessorStrategyRegistry;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowExecutionLogger;

import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;
import vacademy.io.admin_core_service.features.workflow.enums.NodeType;
import vacademy.io.admin_core_service.features.workflow.dto.execution_log.BaseNodeExecutionDetails;
import vacademy.io.admin_core_service.features.workflow.engine.action.IteratorProcessorStrategy;
import vacademy.io.admin_core_service.features.workflow.dto.execution_log.IteratorExecutionDetails;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class ActionNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final DataProcessorStrategyRegistry strategyRegistry;
    private final WorkflowExecutionLogger executionLogger;

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

        String workflowExecutionId = (String) context.get("executionId");
        String nodeId = (String) context.get("currentNodeId");

        // Start logging
        String logId = null;
        long startTime = System.currentTimeMillis();
        if (workflowExecutionId != null && nodeId != null) {
            logId = executionLogger.startNodeExecution(workflowExecutionId, nodeId, NodeType.ACTION, context);
        }

        Map<String, Object> changes = new HashMap<>();
        try {
            ActionNodeDTO actionNodeDTO = objectMapper.readValue(nodeConfigJson, ActionNodeDTO.class);

            String dataProcessor = actionNodeDTO.getDataProcessor();
            if (dataProcessor == null || dataProcessor.isBlank()) {
                log.warn("ActionNode missing dataProcessor");
                if (logId != null) {
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                            "Missing dataProcessor");
                }
                return changes;
            }

            // Get the appropriate strategy for this data processor
            DataProcessorStrategy strategy = strategyRegistry.getStrategy(dataProcessor);
            if (strategy == null) {
                log.warn("No strategy found for dataProcessor: {}", dataProcessor);
                changes.put("error", "No strategy found for: " + dataProcessor);
                if (logId != null) {
                    executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                            "No strategy found for: " + dataProcessor);
                }
                return changes;
            }

            // Execute the strategy
            Object config = actionNodeDTO.getConfig();
            Map<String, Object> itemContext = new HashMap<>(context);

            Map<String, Object> result = strategy.execute(context, config, itemContext);

            Object executionDetails = null;
            if (result != null) {
                // Extract execution details if present (e.g. from IteratorProcessorStrategy)
                if (result.containsKey(IteratorProcessorStrategy.EXECUTION_DETAILS_KEY)) {
                    executionDetails = result.get(IteratorProcessorStrategy.EXECUTION_DETAILS_KEY);
                    result.remove(IteratorProcessorStrategy.EXECUTION_DETAILS_KEY);
                }

                changes.putAll(result);
            }

            log.info("Successfully executed {} strategy", dataProcessor);

            // Complete logging with success (or failure if details indicate so)
            if (logId != null) {
                Object finalDetails = executionDetails;
                ExecutionLogStatus status = ExecutionLogStatus.SUCCESS;
                String errorMessage = null;
                long duration = System.currentTimeMillis() - startTime;

                if (finalDetails instanceof IteratorExecutionDetails) {
                    IteratorExecutionDetails iterDetails = (IteratorExecutionDetails) finalDetails;
                    iterDetails.setExecutionTimeMs(duration);
                    // If we have failure count > 0, we might want to mark as PARTIAL_SUCCESS or
                    // FAILED
                    if (iterDetails.getFailureCount() != null && iterDetails.getFailureCount() > 0) {
                        // Since IteratorProcessorStrategy aborts on error, it's likely FAILED.
                        status = ExecutionLogStatus.FAILED;
                        if (iterDetails.getFailedItems() != null && !iterDetails.getFailedItems().isEmpty()) {
                            errorMessage = iterDetails.getFailedItems().get(0).getErrorMessage();
                        }
                    }
                } else {
                    // Default details for other strategies
                    finalDetails = BaseNodeExecutionDetails.builder()
                            .inputContext(executionLogger.sanitizeContext(context))
                            .outputContext(executionLogger.sanitizeContext(changes))
                            .executionTimeMs(duration)
                            .build();
                }

                executionLogger.completeNodeExecution(logId, status, finalDetails, errorMessage);
            }

        } catch (Exception e) {
            log.error("Error handling ActionNode", e);
            changes.put("error", e.getMessage());

            // Log failure
            if (logId != null) {
                executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                        e.getMessage());
            }
        }
        return changes;
    }
}
