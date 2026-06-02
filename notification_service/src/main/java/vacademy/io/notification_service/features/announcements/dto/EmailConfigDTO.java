package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO for email configuration dropdown options
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailConfigDTO {

    /**
     * Stable handle for the row from the client's perspective. Backed by `type`
     * (the JSON key inside institute.setting.EMAIL_SETTING.data), since `type`
     * is the natural primary key for an email configuration and is immutable
     * once created.
     */
    private String id;

    private String email;
    private String name;
    private String type; // marketing, transactional, notifications
    private String description;
    private String displayText; // For frontend dropdown display
}
