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
    
    // Recipients (Inclusions)
    private List<RecipientResponse> recipients;
    
    // Exclusions
    private List<RecipientResponse> exclusions;
    
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
        // Original stats
        private Long totalRecipients;
        private Long deliveredCount;
        private Long readCount;
        private Long failedCount;
        private Double deliveryRate;
        private Double readRate;
        
        // Enhanced SES Email Event Stats
        private Long emailsSent;               // Total emails sent
        private Long emailsSend;               // Emails accepted by SES (SES send event)
        private Long emailsDelivered;          // Emails successfully delivered (SES delivery event)
        private Long emailsOpened;             // Emails opened by recipients (SES open event)
        private Long emailsClicked;            // Emails with links clicked (SES click event)
        private Long emailsBounced;            // Emails that bounced (SES bounce event)
        private Long emailsRejected;           // Emails rejected by SES (SES reject event)
        private Long emailsComplained;         // Emails marked as spam/complaint (SES complaint event)
        private Long emailsPending;            // Emails sent but no SES event received yet
        
        // Enhanced rates
        private Double emailDeliveryRate;      // (emailsDelivered / emailsSent) * 100
        private Double emailOpenRate;          // (emailsOpened / emailsDelivered) * 100
        private Double emailClickRate;         // (emailsClicked / emailsDelivered) * 100
        private Double emailBounceRate;        // (emailsBounced / emailsSent) * 100
        private Double emailRejectRate;        // (emailsRejected / emailsSent) * 100
    }
}