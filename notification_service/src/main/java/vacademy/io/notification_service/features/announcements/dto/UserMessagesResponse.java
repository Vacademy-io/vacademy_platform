package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.enums.ModeType;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserMessagesResponse {
    private String messageId;
    private String announcementId;
    private String title;
    private RichTextDataResponse content;
    private String createdBy;
    private String createdByName;
    private String createdByRole;
    private ModeType modeType;
    private MessageStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime deliveredAt;
    private Boolean isRead;
    private Boolean isDismissed;
    private LocalDateTime interactionTime;
    
    // Mode-specific settings
    private Object modeSettings;
    
    // Replies count for community/DM modes
    private Long repliesCount;
    private List<MessageReplyResponse> recentReplies;
    
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
    public static class MessageReplyResponse {
        private String id;
        private String userId;
        private String userName;
        private String userRole;
        private RichTextDataResponse content;
        private LocalDateTime createdAt;
        private Long childRepliesCount;
    }
}