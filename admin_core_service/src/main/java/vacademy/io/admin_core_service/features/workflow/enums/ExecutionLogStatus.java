package vacademy.io.admin_core_service.features.workflow.enums;

/**
 * Represents the execution status of a workflow node.
 * 
 * <ul>
 * <li>RUNNING - Node execution has started but not yet completed</li>
 * <li>SUCCESS - All operations completed successfully without any errors</li>
 * <li>PARTIAL_SUCCESS - Some items failed but node completed (e.g., 20/500
 * items failed in iterator)</li>
 * <li>FAILED - Node execution failed completely, could not complete</li>
 * <li>SKIPPED - Node was skipped due to conditional execution</li>
 * </ul>
 */
public enum ExecutionLogStatus {
    RUNNING,
    SUCCESS,
    PARTIAL_SUCCESS,
    FAILED,
    SKIPPED
}
