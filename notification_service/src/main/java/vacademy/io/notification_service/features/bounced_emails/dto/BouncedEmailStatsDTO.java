package vacademy.io.notification_service.features.bounced_emails.dto;

/**
 * DTO for bounced email statistics
 */
public record BouncedEmailStatsDTO(
    long totalBlocked,
    long permanentBounces,
    long transientBounces
) {}

