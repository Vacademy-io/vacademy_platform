package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateTicketRequest {
    private String subject;
    private String category;   // BUG | QUESTION | BILLING | FEATURE_REQUEST | OTHER
    private String priority;   // MAJOR | MINOR
    private String message;    // first message body
    private List<AttachmentDto> attachments;
}
