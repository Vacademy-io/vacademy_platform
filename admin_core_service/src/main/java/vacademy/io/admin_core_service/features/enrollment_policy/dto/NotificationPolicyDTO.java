package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;

import java.util.List;

/**
 * Represents a notification policy for a specific trigger.
 * Supports both old and new JSON formats for backward compatibility.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPolicyDTO {
    NotificationTriggerType trigger;

    /** Old field name - kept for backward compatibility with processors */
    Integer daysBefore;

    /** New field name - for JSON format with daysBeforeExpiry */
    Integer daysBeforeExpiry;

    /** For DURING_WAITING_PERIOD - send every N days */
    Integer sendEveryNDays;

    /** For DURING_WAITING_PERIOD - max number of notifications */
    Integer maxSends;

    /** Old field name - kept for backward compatibility with processors */
    List<ChannelNotificationDTO> notifications;

    /**
     * New field name - single notification config (from JSON notificationConfig)
     */
    NotificationConfigDTO notificationConfig;

    /**
     * Helper method to get days before expiry (supports both old and new field
     * names)
     */
    public Integer getEffectiveDaysBefore() {
        return daysBeforeExpiry != null ? daysBeforeExpiry : daysBefore;
    }
}
