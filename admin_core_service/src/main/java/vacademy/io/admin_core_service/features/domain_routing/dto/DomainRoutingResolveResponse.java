package vacademy.io.admin_core_service.features.domain_routing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DomainRoutingResolveResponse {
    private String instituteId;
    private String instituteName;
    private String instituteLogoFileId;
    private String instituteThemeCode;
    private String role;
    private String redirect;
    private String privacyPolicyUrl;
    private String afterLoginRoute;
    private String adminPortalAfterLogoutRoute;
    private String homeIconClickRoute;
    private String termsAndConditionUrl;
    private String theme;
    private String tabText;
    private Boolean allowSignup;
    private String tabIconFileId;
    private String fontFamily;
    private Boolean allowGoogleAuth;
    private Boolean allowGithubAuth;
    private Boolean allowEmailOtpAuth;
    private Boolean allowUsernamePasswordAuth;
}


