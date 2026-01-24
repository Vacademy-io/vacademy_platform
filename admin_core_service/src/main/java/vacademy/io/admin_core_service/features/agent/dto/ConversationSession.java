package vacademy.io.admin_core_service.features.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Represents an agent conversation session.
 * Stores conversation history, context, and state.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationSession {

    private String sessionId;
    private String userId;
    private String instituteId;
    private String model;

    private SessionState state;
    private LocalDateTime createdAt;
    private LocalDateTime lastActivityAt;
    private LocalDateTime expiresAt;

    // Conversation history for LLM context
    @Builder.Default
    private List<ChatMessage> history = new ArrayList<>();

    // Tools discovered for this session (pinned after first vector search)
    @Builder.Default
    private List<ToolDefinition> pinnedTools = new ArrayList<>();

    // Additional context (institute, course, etc.)
    @Builder.Default
    private Map<String, Object> context = new ConcurrentHashMap<>();

    // User's JWT token for API calls
    private String userToken;

    public enum SessionState {
        ACTIVE, // Agent is processing
        AWAITING_INPUT, // Waiting for user confirmation
        COMPLETED, // Task finished
        TIMED_OUT, // User didn't respond in time
        ERROR // Error occurred
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        private String role; // "system", "user", "assistant", "tool"
        private String content;
        private String toolCallId; // For tool responses
        private String toolName; // For tool calls/responses
        private Object toolArguments; // For tool calls
        private LocalDateTime timestamp;

        public static ChatMessage system(String content) {
            return ChatMessage.builder()
                    .role("system")
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        public static ChatMessage user(String content) {
            return ChatMessage.builder()
                    .role("user")
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        public static ChatMessage assistant(String content) {
            return ChatMessage.builder()
                    .role("assistant")
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        public static ChatMessage toolCall(String toolCallId, String toolName, Object arguments) {
            return ChatMessage.builder()
                    .role("assistant")
                    .toolCallId(toolCallId)
                    .toolName(toolName)
                    .toolArguments(arguments)
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        public static ChatMessage toolResult(String toolCallId, String toolName, String content) {
            return ChatMessage.builder()
                    .role("tool")
                    .toolCallId(toolCallId)
                    .toolName(toolName)
                    .content(content)
                    .timestamp(LocalDateTime.now())
                    .build();
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToolDefinition {
        private String name;
        private String description;
        private String endpoint;
        private String method;
        private List<ToolParameter> parameters;
        private String sampleInput;
        private String sampleOutput;
        private boolean requiresConfirmation;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ToolParameter {
            private String name;
            private String type;
            private String description;
            private boolean required;
            private String location; // "body", "path", "query"
        }
    }

    // ========== Helper Methods ==========

    public void addMessage(ChatMessage message) {
        if (history == null) {
            history = new ArrayList<>();
        }
        history.add(message);
        lastActivityAt = LocalDateTime.now();
    }

    public void updateActivity() {
        lastActivityAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return expiresAt != null && LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isAwaitingInput() {
        return state == SessionState.AWAITING_INPUT;
    }

    public static ConversationSession create(String sessionId, String userId, String instituteId,
            String model, String userToken) {
        LocalDateTime now = LocalDateTime.now();
        return ConversationSession.builder()
                .sessionId(sessionId)
                .userId(userId)
                .instituteId(instituteId)
                .model(model)
                .userToken(userToken)
                .state(SessionState.ACTIVE)
                .createdAt(now)
                .lastActivityAt(now)
                .expiresAt(now.plusMinutes(30)) // 30 min session expiry
                .history(new ArrayList<>())
                .pinnedTools(new ArrayList<>())
                .context(new ConcurrentHashMap<>())
                .build();
    }
}
