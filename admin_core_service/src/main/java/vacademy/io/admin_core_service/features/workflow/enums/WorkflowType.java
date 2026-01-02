package vacademy.io.admin_core_service.features.workflow.enums;

/**
 * Defines the type of workflow execution.
 * Distinguishes between scheduled and event-driven (trigger-based) workflows.
 */
public enum WorkflowType {

    /**
     * Workflow executed on a schedule (cron, interval, etc.).
     * Associated with WorkflowSchedule entity.
     */
    SCHEDULED,

    /**
     * Workflow executed by an event trigger.
     * Associated with WorkflowTrigger entity.
     */
    EVENT_DRIVEN
}
