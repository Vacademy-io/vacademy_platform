package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Carried inside AnnouncementEvent.data for CHAT_MESSAGE / CHAT_READ SSE events.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessagePayload {
    private String conversationId;
    private String conversationType;
    private ChatMessageResponse message; // null for CHAT_READ
    private String readerUserId;         // set for CHAT_READ
    private Long lastReadSeq;            // set for CHAT_READ
}
