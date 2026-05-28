package vacademy.io.notification_service.features.email_inbox.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailConversationDTO {

    /** Counterparty email address (the audience member). */
    private String email;
    /** Resolved display name when available. */
    private String name;
    /** Linked user id when resolvable. */
    private String userId;
    /** Direction of the last message: OUTGOING or INCOMING. */
    private String lastMessageDirection;
    /** Truncated preview of the last message (HTML stripped). */
    private String lastMessagePreview;
    /** When the last message was sent/received. Jackson emits Instant as ISO-8601 with trailing Z. */
    private Instant lastMessageTime;
    /** Number of inbound messages newer than the latest outbound to this counterparty. */
    private long unreadCount;
}
