package vacademy.io.admin_core_service.features.learner_invitation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@Builder
public class OneLearnerInvitationResponse {
    private LearnerInvitationResponseDTO learnerInvitationResponseDTO;
    private LearnerInvitationDTO learnerInvitation;
}
