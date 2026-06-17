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
public class SupportTicketDto {
    private String id;
    private String instituteId;
    private String instituteName;
    private String raisedByUserId;
    private String raisedByName;
    private String raisedByEmail;
    private String raisedByRole;
    private String subject;
    private String category;
    private String priority;
    private String status;
    private String planAtCreation;
    private String assignedEngineerId;
    private String assignedEngineerName;
    private Date firstResponseDueAt;
    private Date firstRespondedAt;
    private Date resolvedAt;
    private Date lastMessageAt;
    private int messageCount;
    /** Computed: no support reply yet and the response-due time has passed. */
    private boolean overdue;
    private Date createdAt;
    private Date updatedAt;
    /** Populated only on the single-ticket detail endpoints; null in list responses. */
    private List<SupportTicketMessageDto> messages;
    /** Auto-captured diagnostics (browser/device + server IP). Support-view detail only. */
    private Object clientContext;
}
