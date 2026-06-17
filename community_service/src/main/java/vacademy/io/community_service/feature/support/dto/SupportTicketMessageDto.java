package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportTicketMessageDto {
    private String id;
    private String ticketId;
    private String senderType;     // CUSTOMER | SUPPORT | SYSTEM
    private String senderName;
    private String senderUserId;
    private String body;
    private List<AttachmentDto> attachments;
    private boolean internalNote;
    private Date createdAt;
}
