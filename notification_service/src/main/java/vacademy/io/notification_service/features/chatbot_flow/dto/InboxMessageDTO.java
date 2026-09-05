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

    // --- Template-send context (only present on outgoing template messages) ---
    /** Name of the WhatsApp template this message was sent from, e.g. "launchoffer". */
    private String templateName;
    /** Sending provider recorded on the log: META, WATI, COMBOT, ... */
    private String provider;
    /** SUCCESS or FAILED — whether the provider accepted the send. */
    private String deliveryStatus;
    /** Provider rejection reason, when deliveryStatus == FAILED. */
    private String error;
    /** Template header type: NONE, TEXT, IMAGE, VIDEO, DOCUMENT. */
    private String headerType;
    /** Actual media URL for an IMAGE/VIDEO/DOCUMENT header, so the UI can display the attachment. */
    private String headerMediaUrl;

    /**
     * What we tried to send on a failed non-template message: text, interactive, media, template.
     * Present only alongside {@code deliveryStatus == FAILED}.
     */
    private String attemptedType;
}
