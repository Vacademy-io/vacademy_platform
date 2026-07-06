package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

/**
 * Registration-template settings, serialized as a ROOT-LEVEL
 * {"SUB_ORG_REGISTRATION_SETTING": {...}} block in enroll_invite.setting_json.
 *
 * Deliberately independent from {@code EnrollInviteSettingDTO} / the production
 * SUB_ORG_SETTING block (parsed by InstituteCustomFieldMapper) — template invites
 * (tag=SUB_ORG_REGISTRATION) never carry SUB_ORG_SETTING, and this DTO is only
 * read/written by the registration services.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SubOrgRegistrationSettingDTO {

    @JsonProperty("SUB_ORG_REGISTRATION_SETTING")
    private RegistrationSetting registrationSetting;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegistrationSetting {

        /** Ordered wizard steps, e.g. ["DETAILS","CUSTOM_FIELDS","TNC"]. DETAILS is always first. */
        @JsonProperty("STEPS")
        private List<String> steps;

        /** Media file id of the T&C PDF; optional part of the TNC step. */
        @JsonProperty("TNC_FILE_ID")
        private String tncFileId;

        /**
         * Consent statements, each rendered as its own required checkbox on the TNC step.
         * Inline links use [label](url) syntax, e.g.
         * "We have read the [Code of Conduct](https://...) and agree to abide by it."
         * TNC step exists when tncFileId OR this list is set.
         */
        @JsonProperty("TNC_CONSENT_ITEMS")
        private List<String> tncConsentItems;

        /** Max COMPLETED registrations through this link. Null = unlimited. */
        @JsonProperty("MAX_REGISTRATIONS")
        private Integer maxRegistrations;

        /** Stored for P1 approval flow; unused in P0 (always auto-approve). */
        @JsonProperty("REQUIRES_APPROVAL")
        private Boolean requiresApproval;

        // ---- Per-spawned-sub-org config, passed to createSubOrgWithSubscription ----

        @JsonProperty("MEMBER_COUNT")
        private Integer memberCount;

        @JsonProperty("VALIDITY_DAYS")
        private Integer validityDays;

        @JsonProperty("AUTH_ROLES")
        private List<String> authRoles;

        @JsonProperty("ADMIN_PERMISSIONS")
        private List<String> adminPermissions;

        @JsonProperty("ALLOWED_TEAM_ROLES")
        private List<String> allowedTeamRoles;

        // ---- P1a payment config (paid templates). Absent/FREE = P0 behavior. ----

        @JsonProperty("PAYMENT_TYPE")
        private String paymentType;

        @JsonProperty("PAYMENT_OPTION_ID")
        private String paymentOptionId;

        @JsonProperty("VENDOR")
        private String vendor;

        @JsonProperty("VENDOR_ID")
        private String vendorId;

        @JsonProperty("CURRENCY")
        private String currency;

        /**
         * DigiLocker KYC documents for the KYC step: ["AADHAAR"] or ["AADHAAR","PAN"].
         * Empty/absent = no KYC step.
         */
        @JsonProperty("KYC_DOCUMENTS")
        private List<String> kycDocuments;

        // ---- Presentation + completion config (all optional). ----

        /** Helper text under the org-name field on the DETAILS step. Max 300 chars. */
        @JsonProperty("ORG_NAME_HINT")
        private String orgNameHint;

        /** True = DETAILS step also collects a postal address (line1/city/state/pincode required). */
        @JsonProperty("COLLECT_ADDRESS")
        private Boolean collectAddress;

        /** Instructions shown above the KYC step. Max 1000 chars. */
        @JsonProperty("KYC_INSTRUCTIONS")
        private String kycInstructions;

        /**
         * Completion precedence: completionRedirectUrl set -> auto-redirect; else
         * completionMessage/button set -> custom message page; else default success
         * copy + "Go to Admin Portal" button -> admin_portal_url.
         */
        @JsonProperty("COMPLETION_MESSAGE")
        private String completionMessage;

        /** Set together with COMPLETION_BUTTON_URL (both or neither). Max 100 chars. */
        @JsonProperty("COMPLETION_BUTTON_LABEL")
        private String completionButtonLabel;

        /** Must start with https://. */
        @JsonProperty("COMPLETION_BUTTON_URL")
        private String completionButtonUrl;

        /** Auto-redirect target after completion; must start with https://. */
        @JsonProperty("COMPLETION_REDIRECT_URL")
        private String completionRedirectUrl;
    }
}
