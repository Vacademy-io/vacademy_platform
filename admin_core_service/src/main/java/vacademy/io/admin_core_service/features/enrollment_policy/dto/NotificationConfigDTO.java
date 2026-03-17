package vacademy.io.admin_core_service.features.enrollment_policy.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * DTO for notification configuration.
 * Contains the type and content of a notification.
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationConfigDTO {
        /**
         * Type of notification: EMAIL, WHATSAPP, PUSH
         */
        String type;

        /**
         * Content of the notification.
         * For EMAIL: {subject, body}
         * For WHATSAPP: {templateName, parameters}
         */
        Object content;

        /**
         * Optional template name for predefined templates.
         */
        String templateName;
}
