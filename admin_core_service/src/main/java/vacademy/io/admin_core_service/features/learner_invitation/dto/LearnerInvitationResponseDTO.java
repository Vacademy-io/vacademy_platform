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
public class LearnerInvitationResponseDTO {
    private String id;
    private String instituteId;
    private String learnerInvitationId;
    private String status;
    private String fullName;
    private String email;
    private String contactNumber;
    private String batchOptionsJson;
    private String batchSelectionResponseJson;
    private Date recordedOn;
    private List<LearnerInvitationCustomFieldResponseDTO> customFieldsResponse;
}
