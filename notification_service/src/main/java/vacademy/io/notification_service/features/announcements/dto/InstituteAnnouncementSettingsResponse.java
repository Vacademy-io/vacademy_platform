package vacademy.io.notification_service.features.announcements.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InstituteAnnouncementSettingsResponse {
    
    private String id;
    private String instituteId;
    private AnnouncementSettings settings;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnnouncementSettings {
        private CommunitySettings community;
        private DashboardPinSettings dashboardPins;
        private SystemAlertSettings systemAlerts;
        private DirectMessageSettings directMessages;
        private StreamSettings streams;
        private ResourceSettings resources;
        private GeneralSettings general;
        private FirebaseSettings firebase;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommunitySettings {
        @JsonProperty("students_can_send")
        private Boolean studentsCanSend;
        
        @JsonProperty("teachers_can_send")
        private Boolean teachersCanSend;
        
        @JsonProperty("admins_can_send")
        private Boolean adminsCanSend;
        
        @JsonProperty("allow_replies")
        private Boolean allowReplies;
        
        @JsonProperty("moderation_enabled")
        private Boolean moderationEnabled;
        
        @JsonProperty("allowed_tags")
        private List<String> allowedTags;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DashboardPinSettings {
        @JsonProperty("students_can_create")
        private Boolean studentsCanCreate;
        
        @JsonProperty("teachers_can_create")
        private Boolean teachersCanCreate;
        
        @JsonProperty("admins_can_create")
        private Boolean adminsCanCreate;
        
        @JsonProperty("max_duration_hours")
        private Integer maxDurationHours;
        
        @JsonProperty("max_pins_per_user")
        private Integer maxPinsPerUser;
        
        @JsonProperty("require_approval")
        private Boolean requireApproval;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemAlertSettings {
        @JsonProperty("students_can_send")
        private Boolean studentsCanSend;
        
        @JsonProperty("teachers_can_send")
        private Boolean teachersCanSend;
        
        @JsonProperty("admins_can_send")
        private Boolean adminsCanSend;
        
        @JsonProperty("high_priority_roles")
        private List<String> highPriorityRoles;
        
        @JsonProperty("auto_dismiss_hours")
        private Integer autoDismissHours;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DirectMessageSettings {
        @JsonProperty("students_can_send")
        private Boolean studentsCanSend;
        
        @JsonProperty("teachers_can_send")
        private Boolean teachersCanSend;
        
        @JsonProperty("admins_can_send")
        private Boolean adminsCanSend;
        
        @JsonProperty("allow_student_to_student")
        private Boolean allowStudentToStudent;
        
        @JsonProperty("allow_replies")
        private Boolean allowReplies;
        
        @JsonProperty("moderation_enabled")
        private Boolean moderationEnabled;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StreamSettings {
        @JsonProperty("students_can_send")
        private Boolean studentsCanSend;
        
        @JsonProperty("teachers_can_send")
        private Boolean teachersCanSend;
        
        @JsonProperty("admins_can_send")
        private Boolean adminsCanSend;
        
        @JsonProperty("allow_during_class")
        private Boolean allowDuringClass;
        
        @JsonProperty("auto_archive_hours")
        private Integer autoArchiveHours;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ResourceSettings {
        @JsonProperty("students_can_upload")
        private Boolean studentsCanUpload;
        
        @JsonProperty("teachers_can_upload")
        private Boolean teachersCanUpload;
        
        @JsonProperty("admins_can_upload")
        private Boolean adminsCanUpload;
        
        @JsonProperty("allowed_folders")
        private List<String> allowedFolders;
        
        @JsonProperty("allowed_categories")
        private List<String> allowedCategories;
        
        @JsonProperty("max_file_size_mb")
        private Integer maxFileSizeMb;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneralSettings {
        @JsonProperty("announcement_approval_required")
        private Boolean announcementApprovalRequired;
        
        @JsonProperty("max_announcements_per_day")
        private Integer maxAnnouncementsPerDay;
        
        @JsonProperty("allowed_mediums")
        private List<String> allowedMediums;
        
        @JsonProperty("default_timezone")
        private String defaultTimezone;
        
        @JsonProperty("retention_days")
        private Integer retentionDays;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FirebaseSettings {
        @JsonProperty("serviceAccountJson")
        private String serviceAccountJson;
        @JsonProperty("serviceAccountJsonBase64")
        private String serviceAccountJsonBase64;
    }
}