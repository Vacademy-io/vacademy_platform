package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
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
    
    // === Individual User Operations ===
    private List<String> individualUserIds;       //new added fields
    private List<String> deletedIndividualUserIds;

    private String joinLink;

    // === Notification Setting Operations ===
    private List<NotificationActionDTO> addedNotificationActions;
    private List<NotificationActionDTO> updatedNotificationActions;
    private List<String> deletedNotificationActionIds;

    // === Custom Field Operations ===
    // Legacy add/update/delete tri-arrays. Kept for backward compatibility with
    // older clients; new clients should send `instituteCustomFields` instead.
    @Deprecated
    private List<CustomFieldDTO> addedFields;
    @Deprecated
    private List<CustomFieldDTO> updatedFields;
    @Deprecated
    private List<String> deletedFieldIds;

    /**
     * Unified custom-field picker payload (custom fields revamp).
     *
     * The frontend sends the FULL list of fields the admin selected for this
     * live session — institute defaults that were pre-selected (and not
     * un-checked) plus any ad-hoc fields the admin added in the dialog.
     * The backend reconciles by calling
     * {@code InstituteCustomFiledService.syncFeatureCustomFields(instituteId, "SESSION", sessionId, ...)}.
     *
     * When this field is non-null the legacy tri-arrays above are ignored.
     */
    private List<InstituteCustomFieldDTO> instituteCustomFields;

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class NotificationActionDTO {
        private String id; // required for update/delete
        private NotificationTypeEnum type; // ENUM: ON_CREATE, ON_LIVE, BEFORE_LIVE, ATTENDANCE
        private NotifyBy notifyBy;
        private String time; // used only if type == BEFORE_LIVE
        private Boolean notify;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class NotifyBy {
        private boolean mail;
        private boolean whatsapp;
        private boolean pushNotification;
        private boolean systemNotification;
    }

    @Data
    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    public static class CustomFieldDTO {
        private String id;
        private String label;
        private boolean required;
        private boolean isDefault;
        private boolean isHidden;
        private String type;
        private List<FieldOptionDTO> options;
    }

    @Data
    public static class FieldOptionDTO {
        private String label;
        private String name;
    }
}
