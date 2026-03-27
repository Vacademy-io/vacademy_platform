package vacademy.io.notification_service.features.chatbot_flow.engine;

import lombok.Builder;
import lombok.Data;

import java.sql.Timestamp;
import java.util.Map;

@Data
@Builder
public class NodeExecutionResult {
    private boolean success;

    /** True if this node needs to wait for user input (CONDITION, AI_RESPONSE) */
    @Builder.Default
    private boolean waitForInput = false;

    /** True if this node schedules a delayed resume (DELAY) */
    @Builder.Default
    private boolean scheduleDelay = false;

    /** For CONDITION nodes: which branch was matched */
    private String selectedBranchId;

    /** Variables to store in session context */
    private Map<String, Object> outputVariables;

    /** For DELAY nodes: when to resume */
    private Timestamp delayUntil;

    /** Error message if execution failed */
    private String errorMessage;
}
