package vacademy.io.admin_core_service.features.suborg.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Assign an <b>existing</b> institute user to a sub-org (channel partner).
 *
 * <p>Distinct from {@link SubOrgTeamAddRequestDTO} on purpose. That flow creates a person:
 * it posts to auth-service {@code /user-invitation/invite}, which can send an invitation
 * email — fine when adding somebody new, wrong when an admin is simply granting an existing
 * staff member access to a partner from the Teams list. This request therefore carries a
 * {@code user_id} instead of an email/name and never touches auth-service.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTeamAssignRequestDTO {
    private String subOrgId;
    private String instituteId;
    /** The existing user to grant access to. */
    private String userId;
    /**
     * Package sessions to scope the grant to. Optional — when omitted, every package
     * session reachable through the sub-org's ACTIVE invites is used, i.e. "give this
     * person access to the whole partner", which is what assigning from the Teams list
     * means. Callers that need finer control (the partner's own Team tab) pass them.
     */
    private List<String> packageSessionIds;
}
