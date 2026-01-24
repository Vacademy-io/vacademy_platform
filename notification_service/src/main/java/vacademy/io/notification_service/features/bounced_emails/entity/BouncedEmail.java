package vacademy.io.notification_service.features.bounced_emails.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * Entity representing an email address that has bounced.
 * Email addresses in this table (with is_active=true) will be blocked from receiving future emails.
 */
@Entity
@Table(name = "bounced_emails")
@Getter
@Setter
@NoArgsConstructor
public class BouncedEmail {

    @Id
    @Column(length = 255, nullable = false)
    @UuidGenerator
    private String id;

    /**
     * The email address that bounced (normalized to lowercase)
     */
    @Column(name = "email", length = 255, nullable = false, unique = true)
    private String email;

    /**
     * SES bounce type: Permanent, Transient, Undetermined
     */
    @Column(name = "bounce_type", length = 50, nullable = false)
    private String bounceType;

    /**
     * SES bounce sub-type: General, NoEmail, Suppressed, OnAccountSuppressionList, MailboxFull, etc.
     */
    @Column(name = "bounce_sub_type", length = 100)
    private String bounceSubType;

    /**
     * Diagnostic information from the bounce event
     */
    @Column(name = "bounce_reason", columnDefinition = "TEXT")
    private String bounceReason;

    /**
     * The SES message ID of the email that bounced
     */
    @Column(name = "ses_message_id", length = 255)
    private String sesMessageId;

    /**
     * Reference to the original notification_log entry
     */
    @Column(name = "original_notification_log_id", length = 255)
    private String originalNotificationLogId;

    /**
     * Whether this bounce block is active. Set to false to unblock an email.
     */
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Constructor for creating a new bounced email entry
     */
    public BouncedEmail(String email, String bounceType, String bounceSubType, 
                        String bounceReason, String sesMessageId, String originalNotificationLogId) {
        this.email = email != null ? email.toLowerCase().trim() : null;
        this.bounceType = bounceType;
        this.bounceSubType = bounceSubType;
        this.bounceReason = bounceReason;
        this.sesMessageId = sesMessageId;
        this.originalNotificationLogId = originalNotificationLogId;
        this.isActive = true;
    }
}

