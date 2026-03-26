package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AsyncWorkflowExecutor {

    private final WorkflowEngineService workflowEngineService;
    private final IdempotencyService idempotencyService;

    @Async("workflowTaskExecutor")
    public void executeAsync(String workflowId, String idempotencyKey, Map<String, Object> context) {
        try {
            log.info("Async execution started for workflow: {} with key: {}", workflowId, idempotencyKey);
            Map<String, Object> result = workflowEngineService.run(workflowId, context);
            idempotencyService.markAsCompleted(idempotencyKey, result);
            log.info("Async execution completed for workflow: {} with key: {}", workflowId, idempotencyKey);
        } catch (Exception e) {
            log.error("Async execution failed for workflow: {} with key: {}", workflowId, idempotencyKey, e);
            idempotencyService.markAsFailed(idempotencyKey, e.getMessage());
        }
    }
}
