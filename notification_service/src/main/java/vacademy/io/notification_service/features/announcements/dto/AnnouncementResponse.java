package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementStatus;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class AnnouncementResponse {
    private String id;
    private String title;
    private RichTextDataResponse content;
    private String instituteId;
    private String createdBy;
    private String createdByName;
    private String createdByRole;
    private AnnouncementStatus status;
    private String timezone;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Recipients
    private List<RecipientResponse> recipients;
    
    // Modes
    private List<ModeResponse> modes;
    
    // Mediums
    private List<MediumResponse> mediums;
    
    // Scheduling
    private SchedulingResponse scheduling;
    
    // Stats
    private AnnouncementStatsResponse stats;
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RichTextDataResponse {
        private String id;
        private String type;
        private String content;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RecipientResponse {
        private String id;
        private String recipientType;
        private String recipientId;
        private String recipientName;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ModeResponse {
        private String id;
        private String modeType;
        private Object settings;
        private Boolean isActive;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MediumResponse {
        private String id;
        private String mediumType;
        private Object config;
        private Boolean isActive;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SchedulingResponse {
        private String id;
        private String scheduleType;
        private String cronExpression;
        private String timezone;
        private LocalDateTime startDate;
        private LocalDateTime endDate;
        private LocalDateTime nextRunTime;
        private LocalDateTime lastRunTime;
        private Boolean isActive;
    }
    
    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AnnouncementStatsResponse {
        private Long totalRecipients;
        private Long deliveredCount;
        private Long readCount;
        private Long failedCount;
        private Double deliveryRate;
        private Double readRate;
    }
}