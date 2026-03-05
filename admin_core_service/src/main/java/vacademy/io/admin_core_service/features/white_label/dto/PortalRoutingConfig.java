package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Per-portal domain routing settings — mirrors DomainRoutingUpsertRequest
 * but without the fields that are derived automatically (domain, subdomain,
 * role, instituteId).
 */
@Data
public class PortalRoutingConfig {

    @JsonProperty("redirect")
    private String redirect;

    @JsonProperty("privacy_policy_url")
    private String privacyPolicyUrl;

    @JsonProperty("terms_and_condition_url")
    private String termsAndConditionUrl;

    @JsonProperty("after_login_route")
    private String afterLoginRoute;

    @JsonProperty("admin_portal_after_logout_route")
    private String adminPortalAfterLogoutRoute;

    @JsonProperty("home_icon_click_route")
    private String homeIconClickRoute;

    @JsonProperty("theme")
    private String theme;

    @JsonProperty("tab_text")
    private String tabText;

    @JsonProperty("allow_signup")
    private Boolean allowSignup;

    @JsonProperty("tab_icon_file_id")
    private String tabIconFileId;

    @JsonProperty("font_family")
    private String fontFamily;

    @JsonProperty("allow_google_auth")
    private Boolean allowGoogleAuth;

    @JsonProperty("allow_github_auth")
    private Boolean allowGithubAuth;

    @JsonProperty("allow_email_otp_auth")
    private Boolean allowEmailOtpAuth;

    @JsonProperty("allow_phone_auth")
    private Boolean allowPhoneAuth;

    @JsonProperty("allow_username_password_auth")
    private Boolean allowUsernamePasswordAuth;

    @JsonProperty("play_store_app_link")
    private String playStoreAppLink;

    @JsonProperty("app_store_app_link")
    private String appStoreAppLink;

    @JsonProperty("windows_app_link")
    private String windowsAppLink;

    @JsonProperty("mac_app_link")
    private String macAppLink;

    @JsonProperty("convert_username_password_to_lowercase")
    private Boolean convertUsernamePasswordToLowercase;
}
