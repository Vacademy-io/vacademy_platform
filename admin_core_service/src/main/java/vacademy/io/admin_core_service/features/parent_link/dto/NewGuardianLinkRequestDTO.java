package vacademy.io.admin_core_service.features.parent_link.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Covers the one case {@link ParentLinkActionRequestDTO} can't: a brand-new
 * manual chip in the assign dialog flagged "is this a guardian?" — the
 * guardian has no user id yet, so there is no valid {@code anchor_user_id}
 * for the regular {@code /link} endpoint. Here the guardian is always
 * created fresh; the student side is either created fresh too
 * ({@code mode = CREATE_NEW}) or an already-existing user is linked
 * ({@code mode = LINK_EXISTING}).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class NewGuardianLinkRequestDTO {
    private String instituteId;
    private String guardianFullName;
    private String guardianEmail;
    private String guardianMobileNumber;

    private String mode; // CREATE_NEW | LINK_EXISTING

    private String studentExistingUserId; // required for LINK_EXISTING
    private String studentFullName; // required for CREATE_NEW
    private String studentEmail;
    private String studentMobileNumber;
}
