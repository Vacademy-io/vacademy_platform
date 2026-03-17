package vacademy.io.admin_core_service.features.workflow.service.idempotency;

import vacademy.io.admin_core_service.features.workflow.dto.IdempotencySettings;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowTrigger;

import java.util.Map;

/**
 * Interface for generating idempotency keys based on different strategies.
 * Each implementation defines a specific algorithm for creating unique keys
 * to prevent duplicate workflow executions.
 */
public interface IdempotencyKeyGenerator {

    /**
     * Generate an idempotency key for a workflow trigger execution.
     *
     * @param trigger   The workflow trigger being executed
     * @param eventName The event name that triggered the workflow
     * @param eventId   The specific event ID (may be null)
     * @param context   Context data provided with the trigger event
     * @param settings  Idempotency configuration settings
     * @return Unique idempotency key string
     * @throws IllegalArgumentException if required configuration is missing
     */
    String generateKey(
            WorkflowTrigger trigger,
            String eventName,
            String eventId,
            Map<String, Object> context,
            IdempotencySettings settings);

    /**
     * Check if this generator supports the given strategy.
     *
     * @param settings The idempotency settings
     * @return true if this generator can handle the strategy
     */
    boolean supports(IdempotencySettings settings);
}
