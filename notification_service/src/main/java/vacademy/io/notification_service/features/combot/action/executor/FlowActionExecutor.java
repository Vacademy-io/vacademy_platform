package vacademy.io.notification_service.features.combot.action.executor;

import vacademy.io.notification_service.features.combot.action.dto.FlowAction;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;

/**
 * Interface for action executors.
 * Each action type has its own executor implementation.
 */
public interface FlowActionExecutor {

    /**
     * Check if this executor can handle the given action.
     */
    boolean canHandle(FlowAction action);

    /**
     * Execute the action with the given context.
     * 
     * @param action  The action to execute
     * @param context The context containing user info, phone, etc.
     */
    void execute(FlowAction action, FlowContext context);
}
