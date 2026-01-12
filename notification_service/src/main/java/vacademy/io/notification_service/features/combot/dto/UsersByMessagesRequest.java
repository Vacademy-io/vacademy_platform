package vacademy.io.notification_service.features.combot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class UsersByMessagesRequest {
    private List<String> messageList;           // e.g., ["YES", "NO", "MAYBE"]
    private String messageType;                 // e.g., "WHATSAPP_MESSAGE_INCOMING"
    private String senderBusinessChannelId;     // e.g., "935184396337916"
}
