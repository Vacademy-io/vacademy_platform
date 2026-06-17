package vacademy.io.notification_service.features.chat.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SendChatMessageRequest {
    private String contentType = "TEXT"; // TEXT | IMAGE | FILE

    @Size(max = 8000)
    private String text;                 // message body (plain/markdown for v1)

    private String richTextType;         // optional: html/text; defaults to "text"

    @Size(max = 2048)
    private String attachmentUrl;

    @Size(max = 512)
    private String attachmentName;

    @Size(max = 128)
    private String attachmentMime;

    private Long attachmentSize;
    private String replyToMessageId;
    private String clientDedupKey;       // idempotency key from the client
}
