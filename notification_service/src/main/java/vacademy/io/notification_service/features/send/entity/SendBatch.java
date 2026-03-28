package vacademy.io.notification_service.features.send.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "send_batch")
public class SendBatch {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "channel", nullable = false, length = 50)
    private String channel;

    @Column(name = "template_name")
    private String templateName;

    @Column(name = "total_recipients")
    private int totalRecipients;

    @Column(name = "sent_count")
    private int sentCount;

    @Column(name = "failed_count")
    private int failedCount;

    /**
     * QUEUED, PROCESSING, COMPLETED, FAILED, PARTIAL
     */
    @Column(name = "status", nullable = false, length = 20)
    private String status;

    /**
     * JSON: full UnifiedSendRequest serialized for replay/audit
     */
    @Column(name = "request_payload", columnDefinition = "TEXT")
    private String requestPayload;

    /**
     * JSON: per-recipient results
     */
    @Column(name = "results_payload", columnDefinition = "TEXT")
    private String resultsPayload;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "source")
    private String source;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
