package vacademy.io.admin_core_service.features.workflow.enums;

/**
 * Defines strategies for generating idempotency keys in trigger-based
 * workflows.
 * Each strategy determines how uniqueness is enforced to prevent duplicate
 * executions.
 */
public enum IdempotencyStrategy {

    /**
     * No idempotency - workflow always executes.
     * Generates a new UUID for each execution.
     * Use case: Workflows that must run on every trigger.
     */
    NONE,

    /**
     * Always unique - generates new UUID each time.
     * Similar to NONE but creates execution tracking record.
     * Use case: Audit trail without deduplication.
     */
    UUID,

    /**
     * Time-based deduplication within a window (e.g., 15 minutes).
     * Key format: trigger_{triggerId}_{roundedTimestamp}
     * Use case: "Max one execution per 15 minutes regardless of who triggered it"
     */
    TIME_WINDOW,

    /**
     * Based on specific context fields (e.g., userId, packageId).
     * Key format: trigger_{triggerId}_{field1Value}_{field2Value}
     * Use case: "One execution per user" or "One per user-package combination"
     */
    CONTEXT_BASED,

    /**
     * Combination of context fields + time window.
     * Key format: trigger_{triggerId}_{field1Value}_{roundedTimestamp}
     * Use case: "Max one execution per user per 15 minutes"
     */
    CONTEXT_TIME_WINDOW,

    /**
     * Based on event type and/or event ID.
     * Key format: trigger_{triggerId}_{eventType}_{eventId}
     * Use case: "One execution per unique event"
     */
    EVENT_BASED,

    /**
     * Custom SpEL expression for maximum flexibility.
     * Key evaluated from expression like:
     * "#{triggerId}_#{ctx['userId']}_#{ctx['roleId']}"
     * Use case: Complex business logic for key generation
     */
    CUSTOM_EXPRESSION
}
