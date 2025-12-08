package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationTriggerType;

import java.util.List;

/**
 * Represents a notification policy for a specific trigger.
 * Can have multiple channel notifications (EMAIL, WHATSAPP, PUSH) each with
 * their own template.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPolicyDTO {
    NotificationTriggerType trigger;
    Integer daysBefore;
    Integer sendEveryNDays;
    Integer maxSends;

    /**
     * List of channel-specific notifications.
     * Each channel can have its own template name and configuration.
     * Example: EMAIL with template "expiry_email", WHATSAPP with template
     * "expiry_whatsapp"
     */
    List<ChannelNotificationDTO> notifications;
}
