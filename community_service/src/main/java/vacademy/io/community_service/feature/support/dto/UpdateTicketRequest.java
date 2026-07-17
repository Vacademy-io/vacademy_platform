package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.Date;
import java.util.List;

/**
 * Super-admin edit of an existing ticket. Every field is optional — only non-null values are
 * applied, so a caller can PATCH just what changed. {@code eta} is the exception: it is applied
 * whenever {@code etaSet} is true, so an explicit null can clear it.
 */
@Data
public class UpdateTicketRequest {
    private String subject;
    private String category;
    private String priority;
    private String status;
    private String source;
    private String assignedEngineerId;   // "" / blank clears the assignee
    private Boolean internalOnly;

    private Date eta;
    /** Send true (with eta null) to clear the ETA; false/absent leaves the ETA untouched. */
    private boolean etaSet;

    /** Replaces the body of the ticket's opening message (support-authored tickets only). */
    private String message;
    /** Replaces the attachments on the ticket's opening message. */
    private List<AttachmentDto> attachments;
    /** True when {@code attachments} should be applied (allows clearing them with an empty list). */
    private boolean attachmentsSet;
}
