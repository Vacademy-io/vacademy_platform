package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InboxConversationDTO {
    private String phone;
    private String senderName;
    private String userId;
    private String lastMessage;
    private String lastMessageType;   // OUTGOING or INCOMING
    /** When the last message was sent/received. Jackson emits Instant as ISO-8601 with trailing Z. */
    private Instant lastMessageTime;
    private long unreadCount;
}
