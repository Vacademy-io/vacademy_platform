package vacademy.io.notification_service.features.email_tracking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for user-centric email tracking
 * Shows all emails sent to a user with their latest tracking status
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEmailTrackingResponse {
    
    /**
     * Original email log ID
     */
    private String emailId;
    
    /**
     * Email address where the email was sent
     */
    private String recipientEmail;
    
    /**
     * User ID associated with the email
     */
    private String userId;
    
    /**
     * Email subject/body preview
     */
    private String emailSubject;
    
    /**
     * Source of the email (e.g., "announcement-service", "email-service")
     */
    private String source;
    
    /**
     * Source ID (e.g., announcement ID)
     */
    private String sourceId;
    
    /**
     * When the email was sent
     */
    private LocalDateTime sentAt;
    
    /**
     * Latest tracking status for this email
     */
    private EmailTrackingStatus latestStatus;
    
    /**
     * Full list of tracking events for this email (in chronological order)
     */
    private List<EmailTrackingStatus> events;
    
    /**
     * Nested class for tracking status details
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmailTrackingStatus {
        
        /**
         * Event type: delivered, opened, clicked, bounced, complaint, pending
         */
        private String eventType;
        
        /**
         * Event timestamp in server local time
         */
        private LocalDateTime eventTimestamp;
        
        /**
         * Event timestamp with timezone offset (ISO 8601, e.g., 2025-01-27T10:30:00+05:30)
         */
        private String eventTimestampIso;
        
        /**
         * Server timezone ID used for formatting (e.g., Asia/Kolkata)
         */
        private String timezone;
        
        /**
         * Additional event details
         */
        private String eventDetails;
        
        /**
         * For bounce: bounce type and subtype
         */
        private String bounceType;
        private String bounceSubType;
        
        /**
         * For click: the link that was clicked
         */
        private String clickedLink;
        
        /**
         * For open/click: IP address and user agent
         */
        private String ipAddress;
        private String userAgent;
        
        /**
         * For complaint: feedback type
         */
        private String complaintFeedbackType;
    }
}


