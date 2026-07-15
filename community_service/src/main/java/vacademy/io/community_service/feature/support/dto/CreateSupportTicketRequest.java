package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.Date;
import java.util.List;

/**
 * Super-admin payload for a ticket the support team logs on an institute's behalf
 * (e.g. an issue a client reported over email / WhatsApp). The ticket is attributed to
 * "Vacademy Support" and still attached to the chosen institute, so it appears in that
 * institute's own support panel exactly like a client-raised one.
 */
@Data
public class CreateSupportTicketRequest {
    private String instituteId;          // required
    private String instituteName;        // snapshot for display (from the picker)
    private String subject;              // required
    private String category;             // BUG | QUESTION | BILLING | FEATURE_REQUEST | OTHER
    private String priority;             // MAJOR | MINOR
    private String message;              // required — the opening message (the reported issue text)
    private String source;               // MANUAL | EMAIL | WHATSAPP | PHONE | OTHER
    private Date eta;                    // optional expected-resolution time
    private String assignedEngineerId;   // optional
    private List<AttachmentDto> attachments;
}
