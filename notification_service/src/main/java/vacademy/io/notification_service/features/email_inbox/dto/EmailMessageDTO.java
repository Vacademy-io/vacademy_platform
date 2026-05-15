package vacademy.io.notification_service.features.email_inbox.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailMessageDTO {
    private String id;
    /** OUTGOING (institute → audience) or INCOMING (audience → institute). */
    private String direction;
    /** Subject line when available (parsed from inbound, may be empty for outbound). */
    private String subject;
    /** Plain-text body preview (HTML stripped, truncated). */
    private String bodyPreview;
    /** Full body — HTML for outbound, plaintext for inbound. */
    private String body;
    /** Counterparty email (the address the institute is talking to). */
    private String counterpartyEmail;
    /** Institute-side address (sender for outbound, receiver for inbound). */
    private String instituteAddress;
    /** ISO timestamp of when the message was sent/received. */
    private String timestamp;
    /** Source identifier (announcement-service, OTP_SERVICE, etc.). */
    private String source;
}
