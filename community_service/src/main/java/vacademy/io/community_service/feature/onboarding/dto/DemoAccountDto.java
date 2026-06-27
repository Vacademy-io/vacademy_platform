package vacademy.io.community_service.feature.onboarding.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Full demo-account view for the super-admin Demo tab (includes credentials). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemoAccountDto {
    private String id;
    private String instituteType;
    private String instituteTypeLabel;
    private String instituteId;
    private String displayName;
    private String adminUsername;
    private String adminPassword;
    private String learnerUsername;
    private String learnerPassword;
    private String adminPortalUrl;
    private String learnerPortalUrl;
    private boolean active;
    private int sortOrder;
}
