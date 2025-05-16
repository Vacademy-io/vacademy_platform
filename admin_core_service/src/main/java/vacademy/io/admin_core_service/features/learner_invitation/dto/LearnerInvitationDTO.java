package vacademy.io.admin_core_service.features.learner_invitation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.sql.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@Builder
public class LearnerInvitationDTO {
    private String id;
    private String name;
    private String status;
    private Date dateGenerated;
    private Date expiryDate;
    private String instituteId;
    private String inviteCode;
    private String batchOptionsJson;
    private String source;
    private String sourceId;
    private List<LearnerInvitationCustomFieldDTO> customFields;
}
