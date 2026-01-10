package vacademy.io.notification_service.features.combot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class InactiveUsersRequest {
    private String messageType;              // e.g., "WHATSAPP_MESSAGE_OUTGOING"
    private String senderBusinessChannelId;  // e.g., "935184396337916"
    private Integer days;                    // e.g., 2
    private String templateName;             // e.g., "day_0_template" (maps to body column)
}
