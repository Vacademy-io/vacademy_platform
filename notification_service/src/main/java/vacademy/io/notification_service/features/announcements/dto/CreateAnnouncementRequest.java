package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.notification_service.features.announcements.enums.ScheduleType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class CreateAnnouncementRequest {
    
    @NotBlank(message = "Title is required")
    @Size(max = 500, message = "Title must not exceed 500 characters")
    private String title;
    
    @NotNull(message = "Content is required")
    @Valid
    private RichTextDataRequest content;
    
    @NotBlank(message = "Institute ID is required")
    private String instituteId;
    
    @NotBlank(message = "Created by is required")
    private String createdBy;
    
    @Size(max = 255, message = "Creator name must not exceed 255 characters")
    private String createdByName;
    
    @Size(max = 100, message = "Creator role must not exceed 100 characters")
    private String createdByRole;
    
    @Size(max = 50, message = "Timezone must not exceed 50 characters")
    private String timezone;
    
    // Recipients
    @NotEmpty(message = "At least one recipient is required")
    @Valid
    private List<RecipientRequest> recipients;
    
    // Modes
    @NotEmpty(message = "At least one mode is required")
    @Valid
    private List<ModeRequest> modes;
    
    // Mediums
    @Valid
    private List<MediumRequest> mediums;
    
    // Scheduling
    @Valid
    private SchedulingRequest scheduling;
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RichTextDataRequest {
        
        @NotBlank(message = "Content type is required")
        @Pattern(regexp = "^(text|html|video|image)$", message = "Content type must be one of: text, html, video, image")
        private String type;
        
        @NotBlank(message = "Content is required")
        @Size(max = 10000, message = "Content must not exceed 10000 characters")
        private String content;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RecipientRequest {
        
        @NotBlank(message = "Recipient type is required")
        @Pattern(regexp = "^(ROLE|USER|PACKAGE_SESSION)$", message = "Recipient type must be one of: ROLE, USER, PACKAGE_SESSION")
        private String recipientType; // ROLE, USER, PACKAGE_SESSION
        
        @NotBlank(message = "Recipient ID is required")
        private String recipientId;
        
        @Size(max = 255, message = "Recipient name must not exceed 255 characters")
        private String recipientName;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ModeRequest {
        
        @NotBlank(message = "Mode type is required")
        @Pattern(regexp = "^(SYSTEM_ALERT|DASHBOARD_PIN|DM|STREAM|RESOURCES|COMMUNITY|TASKS)$", 
                 message = "Mode type must be one of: SYSTEM_ALERT, DASHBOARD_PIN, DM, STREAM, RESOURCES, COMMUNITY, TASKS")
        private String modeType; // SYSTEM_ALERT, DASHBOARD_PIN, DM, STREAM, RESOURCES, COMMUNITY, TASKS
        
        private Map<String, Object> settings;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MediumRequest {
        
        @NotBlank(message = "Medium type is required")
        @Pattern(regexp = "^(WHATSAPP|PUSH_NOTIFICATION|EMAIL)$", 
                 message = "Medium type must be one of: WHATSAPP, PUSH_NOTIFICATION, EMAIL")
        private String mediumType; // WHATSAPP, PUSH_NOTIFICATION, EMAIL
        
        private Map<String, Object> config;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SchedulingRequest {
        
        @NotNull(message = "Schedule type is required")
        private ScheduleType scheduleType;
        
        @Size(max = 100, message = "Cron expression must not exceed 100 characters")
        private String cronExpression;
        
        @Size(max = 50, message = "Timezone must not exceed 50 characters")
        private String timezone;
        
        @Future(message = "Start date must be in the future")
        private LocalDateTime startDate;
        
        private LocalDateTime endDate;
    }
}