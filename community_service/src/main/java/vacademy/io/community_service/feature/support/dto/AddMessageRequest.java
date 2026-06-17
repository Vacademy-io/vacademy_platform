package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.List;

@Data
public class AddMessageRequest {
    private String body;
    private List<AttachmentDto> attachments;
    /** SUPPORT-only: post a private internal note instead of a customer-visible reply. */
    private boolean internalNote;
}
