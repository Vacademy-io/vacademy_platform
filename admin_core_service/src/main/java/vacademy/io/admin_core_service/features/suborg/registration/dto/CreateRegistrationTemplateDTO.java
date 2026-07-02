package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.util.List;

/** Admin request to create an open sub-org registration template (P0: FREE only). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CreateRegistrationTemplateDTO {

    private String name;

    /** Fixed course grant: every spawned sub-org gets exactly these package sessions. */
    private List<String> packageSessionIds;

    /** Seat cap per spawned sub-org. */
    private Integer memberCount;

    private Integer validityInDays;

    private List<String> authRoles;
    private List<String> adminPermissions;
    private List<String> allowedTeamRoles;

    /** Media file id of the T&C PDF. Non-null enables the TNC step. */
    private String tncFileId;

    /** Max COMPLETED registrations through this link. Null = unlimited. */
    private Integer maxRegistrations;

    /** Stored for P1; ignored in P0 (always auto-approve). */
    private Boolean requiresApproval;

    /** Form fields for the CUSTOM_FIELDS step (same shape as invite custom fields). */
    private List<InstituteCustomFieldDTO> instituteCustomFields;
}
