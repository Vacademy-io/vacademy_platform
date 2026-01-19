package vacademy.io.notification_service.features.bounced_emails.dto;

import java.time.LocalDateTime;

/**
 * DTO for bounced email information
 */
public record BouncedEmailDTO(
    String id,
    String email,
    String bounceType,
    String bounceSubType,
    String bounceReason,
    String sesMessageId,
    String originalNotificationLogId,
    Boolean isActive,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}

