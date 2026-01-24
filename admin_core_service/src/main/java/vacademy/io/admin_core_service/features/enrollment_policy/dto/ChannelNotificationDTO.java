package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import lombok.extern.jackson.Jacksonized;

/**
 * Represents a channel-specific notification configuration.
 * Each channel (EMAIL, WHATSAPP, PUSH) can have its own template and
 * configuration.
 */
@Value
@Jacksonized
@SuperBuilder
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChannelNotificationDTO {
    /**
     * Channel type: EMAIL, WHATSAPP, PUSH
     */
    String channel;

    /**
     * Template name for this channel (looked up in Templates table by instituteId,
     * name, and type=channel)
     */
    String templateName;

    /**
     * Channel-specific notification configuration
     */
    NotificationConfigDTO notificationConfig;
}

