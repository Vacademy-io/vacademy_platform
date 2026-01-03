package vacademy.io.notification_service.features.combot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogSequenceRequest {
    private String anchorMessageType;   // e.g., WHATSAPP_OUTGOING_MESSAGE
    private String anchorMessageBody;   // e.g., "Season 5 Challenge"
    private String reactionMessageType; // e.g., WHATSAPP_INCOMING_MESSAGE
    private String reactionMessageBody; // e.g., "I'm in"
}
