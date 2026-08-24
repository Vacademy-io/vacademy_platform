package vacademy.io.admin_core_service.features.reporting.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;
import java.util.UUID;

/**
 * Who actually received a document, and what was in their copy.
 *
 * Two recipients of the same run can receive materially different documents,
 * because sections are filtered per role and learner rows are filtered to the
 * reader's own cohorts. The audit is only meaningful if it records the copy that
 * was sent rather than the schedule that produced it.
 */
@Entity
@Table(name = "report_run_recipient")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportRunRecipient {

    @Id
    @Column(name = "id")
    private String id;

    @Column(name = "run_id", nullable = false)
    private String runId;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "email")
    private String email;

    @Column(name = "role")
    private String role;

    @Column(name = "sections_sent")
    private String sectionsSent;

    @Column(name = "named_learners")
    private Integer namedLearners;

    @Column(name = "delivered")
    private Boolean delivered;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID().toString();
        if (createdAt == null) createdAt = new Timestamp(System.currentTimeMillis());
        if (delivered == null) delivered = Boolean.FALSE;
    }
}
