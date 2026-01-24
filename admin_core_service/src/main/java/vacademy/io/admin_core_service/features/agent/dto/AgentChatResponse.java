package vacademy.io.admin_core_service.features.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response returned immediately when chat is initiated
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentChatResponse {

    private String sessionId;
    private String status; // STARTED, RESUMED, ERROR
    private String message;
    private LocalDateTime timestamp;

    // SSE endpoint to subscribe to for real-time updates
    private String streamEndpoint;

    public static AgentChatResponse started(String sessionId) {
        return AgentChatResponse.builder()
                .sessionId(sessionId)
                .status("STARTED")
                .message("Agent session started. Subscribe to SSE for updates.")
                .timestamp(LocalDateTime.now())
                .streamEndpoint("/admin-core-service/v1/agent/stream/" + sessionId)
                .build();
    }

    public static AgentChatResponse resumed(String sessionId) {
        return AgentChatResponse.builder()
                .sessionId(sessionId)
                .status("RESUMED")
                .message("Agent session resumed.")
                .timestamp(LocalDateTime.now())
                .streamEndpoint("/admin-core-service/v1/agent/stream/" + sessionId)
                .build();
    }

    public static AgentChatResponse error(String message) {
        return AgentChatResponse.builder()
                .status("ERROR")
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
