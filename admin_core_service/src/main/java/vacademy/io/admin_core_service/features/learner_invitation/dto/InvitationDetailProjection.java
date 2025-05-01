package vacademy.io.admin_core_service.features.learner_invitation.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.sql.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public interface InvitationDetailProjection {
    String getId();

    String getName();

    String getInstituteId();

    Date getDateGenerated();

    Long getAcceptedBy();

    String getInviteCode();
}
