package vacademy.io.admin_core_service.features.reporting.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * One generated document. See V462 for why the uniqueness constraint lives in the
 * database rather than in application logic: 4 replicas plus retries mean an
 * in-code check races, and this row is what will eventually authorise a charge.
 */
@Entity
@Table(name = "report_run")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportRun {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "schedule_id", nullable = false)
    private String scheduleId;

    @Column(name = "window_start", nullable = false)
    private Timestamp windowStart;

    @Column(name = "window_end", nullable = false)
    private Timestamp windowEnd;

    @Column(name = "scope_type", nullable = false)
    private String scopeType;

    @Column(name = "scope_id")
    private String scopeId;

    @Column(name = "scope_label")
    private String scopeLabel;

    /** PENDING | CHARGED | SENT | SKIPPED | FAILED */
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "skip_reason")
    private String skipReason;

    @Column(name = "credits_charged")
    private Double creditsCharged;

    @Column(name = "sections_included")
    private String sectionsIncluded;

    @Column(name = "recipient_count")
    private Integer recipientCount;

    @Column(name = "named_learners")
    private Integer namedLearners;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        Timestamp now = new Timestamp(System.currentTimeMillis());
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
