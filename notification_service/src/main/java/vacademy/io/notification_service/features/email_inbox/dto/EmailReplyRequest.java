package vacademy.io.notification_service.features.email_inbox.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailReplyRequest {
    private String instituteId;
    /** Counterparty email to reply to. */
    private String toEmail;
    /** Optional sender override — must be one of the institute's configured senders. */
    private String fromEmail;
    private String subject;
    /** HTML body. */
    private String body;
}
