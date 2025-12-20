package vacademy.io.admin_core_service.features.user_subscription.dto.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

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
    }
}
