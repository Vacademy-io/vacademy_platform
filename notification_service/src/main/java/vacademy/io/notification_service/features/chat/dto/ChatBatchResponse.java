package vacademy.io.notification_service.features.chat.dto;

import lombok.Builder;
import lombok.Data;

/** A batch (package session) surfaced in the chat "start a new batch conversation" picker. */
@Data
@Builder
public class ChatBatchResponse {
    private String packageSessionId;
    private String name;
    /** Existing batch-group conversation id, or null if this batch has no conversation yet. */
    private String conversationId;
}
