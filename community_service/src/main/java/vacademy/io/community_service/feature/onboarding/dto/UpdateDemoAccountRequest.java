package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Editable fields for a demo account. The institute id is fixed and never changes. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDemoAccountRequest {
    private String displayName;
    private String adminUsername;
    private String adminPassword;
    private String learnerUsername;
    private String learnerPassword;
    private String adminPortalUrl;
    private String learnerPortalUrl;
    private Boolean active;
    /** When true, push displayName to admin-core so the live demo institute is actually renamed. */
    private Boolean syncNameToInstitute;
}
