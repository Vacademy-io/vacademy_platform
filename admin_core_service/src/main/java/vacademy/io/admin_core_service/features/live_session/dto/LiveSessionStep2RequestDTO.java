package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.live_session.enums.NotificationTypeEnum;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LiveSessionStep2RequestDTO {
    private String sessionId;
    private String accessType;

    private List<String> packageSessionIds;
    private List<String> deletedPackageSessionIds;

    private String joinLink;

    // === Notification Setting Operations ===
    private List<NotificationActionDTO> addedNotificationActions;
    private List<NotificationActionDTO> updatedNotificationActions;
    private List<String> deletedNotificationActionIds;

    // === Custom Field Operations ===
    private List<CustomFieldDTO> addedFields;
    private List<CustomFieldDTO> updatedFields;
    private List<String> deletedFieldIds;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class NotificationActionDTO {
        private String id; // required for update/delete
        private NotificationTypeEnum type; // ENUM: ON_CREATE, ON_LIVE, BEFORE_LIVE
        private NotifyBy notifyBy;
        private String time; // used only if type == BEFORE_LIVE
        private Boolean notify;
    }

    @Data
    public static class NotifyBy {
        private boolean mail;
        private boolean whatsapp;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class CustomFieldDTO {
        private String id;
        private String label;
        private boolean required;
        private boolean isDefault;
        private String type;
        private List<FieldOptionDTO> options;
    }

    @Data
    public static class FieldOptionDTO {
        private String label;
        private String name;
    }
}
