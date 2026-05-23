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
public class InboxMessageDTO {
    private String id;
    private String body;
    private String direction;     // OUTGOING or INCOMING
    /** When the message was sent/received. Jackson emits Instant as ISO-8601 with trailing Z. */
    private Instant timestamp;
    private String source;        // COMBOT, WATI, META
    private String senderName;
    private String status;        // notification_type raw value
}
