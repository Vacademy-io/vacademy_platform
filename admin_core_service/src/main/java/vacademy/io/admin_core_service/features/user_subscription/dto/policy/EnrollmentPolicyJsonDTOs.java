package vacademy.io.admin_core_service.features.user_subscription.dto.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Container class for DTOs used to parse the enrollment policy JSON.
 * These map directly to the JSON structure stored in
 * package_session.enrollment_policy_settings.
 */
public class EnrollmentPolicyJsonDTOs {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EnrollmentPolicySettingsDTO {
        private List<NotificationConfigDTO> notifications;
        private OnExpiryPolicyDTO onExpiry;
        private ReenrollmentPolicyDTO reenrollmentPolicy;
        private WorkflowConfigDTO workflow;
        private OnEnrollmentPolicyDTO onEnrollment;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NotificationConfigDTO {
        private String trigger; // ON_EXPIRY_DATE_REACHED, DURING_WAITING_PERIOD, BEFORE_EXPIRY
        private Integer sendEveryNDays;
        private Integer maxSends;
        private Integer daysBeforeExpiry; // For BEFORE_EXPIRY
        private NotificationDetailsDTO notificationConfig;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NotificationDetailsDTO {
        private String type; // EMAIL, WHATSAPP
        private Object content; // Can be map or object
        private String templateName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OnExpiryPolicyDTO {
        private Integer waitingPeriodInDays;
        private Boolean enableAutoRenewal;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReenrollmentPolicyDTO {
        private Boolean allowReenrollmentAfterExpiry;
        private Integer reenrollmentGapInDays;
        private String activeRepurchaseBehavior;

        /**
         * Custom message shown when user is already actively enrolled.
         */
        private String alreadyEnrolledMessage;

        /**
         * Custom message shown when re-enrollment is blocked due to gap period.
         * Supports placeholder {{allowed_date}}.
         */
        private String reenrollmentBlockedMessage;

        /**
         * Map of upgrade options for frontend display.
         */
        private Map<String, UpgradeOptionDTO> upgradeOptions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WorkflowConfigDTO {
        private Boolean enabled;
        private List<WorkflowItemDTO> workflows;

        /**
         * Map of frontend actions for user interaction.
         * Key: action identifier (e.g., "verify_whatsapp", "contact_support")
         * Value: FrontendActionDTO with type, description, buttonText, and actionUrl
         */
        private Map<String, FrontendActionDTO> frontendActions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class WorkflowItemDTO {
        private String workflowId;
        private String triggerOn; // ENROLLMENT, PAYMENT_SUCCESS, etc.
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OnEnrollmentPolicyDTO {
        /**
         * List of package_session_ids to mark as DELETED when user enrolls in this
         * package.
         * Use case: When user upgrades from demo to paid, terminate all demo sessions.
         */
        private List<String> terminateActiveSessions;

        /**
         * List of package_session_ids that should block enrollment if user is already
         * ACTIVE in them.
         * Use case: Block demo enrollment if user already has an active paid
         * subscription.
         */
        private List<String> blockIfActiveIn;

        /**
         * Custom message to show when enrollment is blocked due to existing active
         * session.
         * If not provided, a default message will be used.
         */
        private String blockMessage;
    }

    /**
     * DTO for frontend action configuration.
     * Used for user-facing interactive elements like WhatsApp buttons, links, etc.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FrontendActionDTO {
        /**
         * Type of the action.
         * Example: "whatsapp", "button", "link"
         */
        private String type;

        /**
         * Description text explaining what this action does.
         * Example: "Open your WhatsApp and verify it"
         */
        private String description;

        /**
         * Button text to display in the UI.
         * Example: "Verify on WhatsApp"
         */
        private String buttonText;

        /**
         * URL for the action (WhatsApp link, redirect URL, etc.)
         * Example: "https://wa.me/447466551586?text=VERIFY"
         */
        private String actionUrl;
    }

    /**
     * DTO for upgrade option configuration.
     * Used for enrollment/upgrade links displayed after demo expiry.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpgradeOptionDTO {
        /**
         * Type of the UI element.
         * Example: "button", "link", "card"
         */
        private String type;

        /**
         * Display text for the upgrade option.
         * Example: "Upgrade Now", "Go Premium"
         */
        private String text;

        /**
         * URL for the upgrade/enrollment action.
         * Example: "https://your-domain.com/enroll/paid-package?session_id=xyz"
         */
        private String url;
    }
}
