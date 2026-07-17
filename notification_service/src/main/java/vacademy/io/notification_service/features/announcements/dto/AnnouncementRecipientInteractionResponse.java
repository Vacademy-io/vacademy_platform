package vacademy.io.notification_service.features.announcements.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.enums.ModeType;

import java.time.LocalDateTime;

/**
 * One recipient's delivery + interaction state for an announcement.
 * Used by the admin dashboard to list who saw / dismissed an announcement.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementRecipientInteractionResponse {
    private String recipientMessageId;
    private String userId;
    private String userName;
    private ModeType modeType;
    private MessageStatus status;
    private LocalDateTime deliveredAt;
    private LocalDateTime readAt;
    private LocalDateTime dismissedAt;
}
