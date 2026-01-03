package vacademy.io.admin_core_service.features.agent.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Event sent via SSE to the frontend.
 * Different event types represent different stages of agent processing.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentEvent {

    private String eventType;
    private String sessionId;
    private LocalDateTime timestamp;

    // For THINKING events
    private String thought;

    // For TOOL_CALL events
    private String toolName;
    private String toolDescription;
    private Map<String, Object> toolArguments;

    // For TOOL_RESULT events
    private Object toolResult;
    private boolean toolSuccess;
    private String toolError;

    // For MESSAGE events
    private String message;

    // For AWAITING_INPUT events
    private String question;
    private List<ConfirmationOption> options;

    // For ERROR events
    private String error;

    // For COMPLETE events
    private String summary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConfirmationOption {
        private String id;
        private String label;
        private String description;
    }

    // ========== Factory Methods ==========

    public static AgentEvent thinking(String sessionId, String thought) {
        return AgentEvent.builder()
                .eventType("THINKING")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .thought(thought)
                .build();
    }

    public static AgentEvent toolCall(String sessionId, String toolName, String toolDescription,
            Map<String, Object> args) {
        return AgentEvent.builder()
                .eventType("TOOL_CALL")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .toolName(toolName)
                .toolDescription(toolDescription)
                .toolArguments(args)
                .build();
    }

    public static AgentEvent toolResult(String sessionId, String toolName, Object result, boolean success,
            String error) {
        return AgentEvent.builder()
                .eventType("TOOL_RESULT")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .toolName(toolName)
                .toolResult(result)
                .toolSuccess(success)
                .toolError(error)
                .build();
    }

    public static AgentEvent message(String sessionId, String message) {
        return AgentEvent.builder()
                .eventType("MESSAGE")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .message(message)
                .build();
    }

    public static AgentEvent awaitingInput(String sessionId, String question, List<ConfirmationOption> options) {
        return AgentEvent.builder()
                .eventType("AWAITING_INPUT")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .question(question)
                .options(options)
                .build();
    }

    public static AgentEvent complete(String sessionId, String summary) {
        return AgentEvent.builder()
                .eventType("COMPLETE")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .summary(summary)
                .build();
    }

    public static AgentEvent error(String sessionId, String error) {
        return AgentEvent.builder()
                .eventType("ERROR")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .error(error)
                .build();
    }

    public static AgentEvent timeout(String sessionId) {
        return AgentEvent.builder()
                .eventType("TIMEOUT")
                .sessionId(sessionId)
                .timestamp(LocalDateTime.now())
                .message("Session timed out waiting for user input")
                .build();
    }
}
