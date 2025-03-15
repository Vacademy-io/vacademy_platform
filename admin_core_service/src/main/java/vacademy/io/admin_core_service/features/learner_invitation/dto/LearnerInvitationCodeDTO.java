package vacademy.io.admin_core_service.features.learner_invitation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.sql.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class LearnerInvitationCodeDTO {
    private String name;
    private String status;
    private Date dateGenerated;
    private Date expiryDate;
    private String instituteId;
    private String inviteCode;
    private String batchOptionsJson;
    private List<String> emailsToSendInvitation;
    private List<LearnerInvitationCustomFieldDTO> customFields;
}
