package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

@Data
public class AssignEngineerRequest {
    /** Engineer id to assign, or null/empty to unassign. */
    private String engineerId;
    /** Optional status to move the ticket to on assignment (e.g. IN_PROGRESS). */
    private String status;
}
