package vacademy.io.admin_core_service.features.workflow.engine.action;

import java.util.Map;

public interface DataProcessorStrategy {
    /**
     * Check if this strategy can handle the given operation
     */
    boolean canHandle(String operation);

    /**
     * Execute the data processing operation
     */
    Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext);

    /**
     * Get the operation type this strategy handles
     */
    String getOperationType();
}