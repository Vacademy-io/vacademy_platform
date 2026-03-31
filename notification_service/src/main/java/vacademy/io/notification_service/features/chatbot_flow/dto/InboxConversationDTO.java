package vacademy.io.notification_service.features.chatbot_flow.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private String lastMessageTime;
    private long unreadCount;
}
