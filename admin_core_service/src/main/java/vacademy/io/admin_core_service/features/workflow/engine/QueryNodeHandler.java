package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.QueryNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowExecutionLogger;
import vacademy.io.admin_core_service.features.workflow.enums.ExecutionLogStatus;
import vacademy.io.admin_core_service.features.workflow.enums.NodeType;
import vacademy.io.admin_core_service.features.workflow.dto.execution_log.QueryExecutionDetails;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final QueryService queryService;
    private final WorkflowExecutionLogger executionLogger;

    @Override
    public boolean supports(String nodeType) {
        return "QUERY".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
            String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates,
            int countProcessed) {
        log.info("QueryNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        String workflowExecutionId = (String) context.get("executionId");
        String nodeId = (String) context.get("currentNodeId");

        // Start logging
        String logId = null;
        long startTime = System.currentTimeMillis();
        if (workflowExecutionId != null && nodeId != null) {
            logId = executionLogger.startNodeExecution(workflowExecutionId, nodeId, NodeType.QUERY, context);
        }

        Map<String, Object> changes = new HashMap<>();
        String prebuiltKey = null;
        int rowsReturned = 0;

        try {
            // Deserialize JSON into DTO
            QueryNodeDTO config = objectMapper.readValue(nodeConfigJson, QueryNodeDTO.class);

            prebuiltKey = config.getPrebuiltKey();
            Map<String, Object> rawParams = config.getParams();

            if (prebuiltKey != null && !prebuiltKey.isBlank()) {
                Map<String, Object> queryParams = new HashMap<>();

                if (rawParams != null) {
                    for (Map.Entry<String, Object> entry : rawParams.entrySet()) {
                        String key = entry.getKey();
                        Object valueExpr = entry.getValue();

                        Object value;
                        if (valueExpr instanceof String) {
                            value = spelEvaluator.evaluate((String) valueExpr, context);
                        } else {
                            value = valueExpr;
                        }
                        queryParams.put(key, value);
                    }
                }

                log.debug("Executing query with key: {}, params: {}", prebuiltKey, queryParams);
                Map<String, Object> queryResult = queryService.execute(prebuiltKey, queryParams);
                if (queryResult != null) {
                    changes.putAll(queryResult);
                    rowsReturned = queryResult.size(); // Approximation
                }
            }

            // Complete logging with success
            if (logId != null) {
                QueryExecutionDetails details = QueryExecutionDetails.builder()
                        .inputContext(executionLogger.sanitizeContext(context))
                        .outputContext(executionLogger.sanitizeContext(changes))
                        .query(prebuiltKey)
                        .rowsReturned(rowsReturned)
                        .executionTimeMs(System.currentTimeMillis() - startTime)
                        .build();

                executionLogger.completeNodeExecution(logId, ExecutionLogStatus.SUCCESS, details, null);
            }

        } catch (Exception e) {
            log.error("Error while processing QueryNodeHandler config", e);
            changes.put("error", e.getMessage());

            // Log failure
            if (logId != null) {
                executionLogger.completeNodeExecution(logId, ExecutionLogStatus.FAILED, null,
                        e.getMessage());
            }
            // We don't throw exception here to allow workflow to continue if error handling
            // is configured
            // But for logging purposes, we marked it as FAILED.
        }

        log.info("Query changes map prepared: {}", changes);
        return changes;
    }

    public interface QueryService {
        Map<String, Object> execute(String prebuiltKey, Map<String, Object> params);
    }
}