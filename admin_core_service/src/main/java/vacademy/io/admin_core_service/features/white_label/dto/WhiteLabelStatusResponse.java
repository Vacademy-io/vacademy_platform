package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Current white-label status for an institute — returned by the GET /status
 * endpoint.
 */
@Data
@Builder
public class WhiteLabelStatusResponse {

    @JsonProperty("is_configured")
    private boolean isConfigured;

    @JsonProperty("cloudflare_enabled")
    private boolean cloudflareEnabled;

    @JsonProperty("domain_type")
    private String domainType;

    @JsonProperty("learner_portal_url")
    private String learnerPortalUrl;

    @JsonProperty("admin_portal_url")
    private String adminPortalUrl;

    @JsonProperty("teacher_portal_url")
    private String teacherPortalUrl;

    @JsonProperty("routing_entries")
    private List<RoutingEntry> routingEntries;

    @Data
    @Builder
    public static class RoutingEntry {
        @JsonProperty("id")
        private String id;

        @JsonProperty("role")
        private String role;

        @JsonProperty("domain")
        private String domain;

        @JsonProperty("subdomain")
        private String subdomain;

        // ── Branding ──────────────────────────────────────────────────────
        @JsonProperty("tab_text")
        private String tabText;

        @JsonProperty("tab_icon_file_id")
        private String tabIconFileId;

        @JsonProperty("theme")
        private String theme;

        @JsonProperty("font_family")
        private String fontFamily;

        // ── Routes ────────────────────────────────────────────────────────
        @JsonProperty("redirect")
        private String redirect;

        @JsonProperty("after_login_route")
        private String afterLoginRoute;

        @JsonProperty("admin_portal_after_logout_route")
        private String adminPortalAfterLogoutRoute;

        @JsonProperty("home_icon_click_route")
        private String homeIconClickRoute;

        // ── Auth ──────────────────────────────────────────────────────────
        @JsonProperty("allow_signup")
        private Boolean allowSignup;

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

        @JsonProperty("convert_username_password_to_lowercase")
        private Boolean convertUsernamePasswordToLowercase;

        // ── Legal / Links ─────────────────────────────────────────────────
        @JsonProperty("privacy_policy_url")
        private String privacyPolicyUrl;

        @JsonProperty("terms_and_condition_url")
        private String termsAndConditionUrl;

        @JsonProperty("play_store_app_link")
        private String playStoreAppLink;

        @JsonProperty("app_store_app_link")
        private String appStoreAppLink;

        @JsonProperty("windows_app_link")
        private String windowsAppLink;

        @JsonProperty("mac_app_link")
        private String macAppLink;
    }
}
