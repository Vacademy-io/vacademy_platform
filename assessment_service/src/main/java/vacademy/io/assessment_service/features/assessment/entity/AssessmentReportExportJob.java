package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Bulk report export job row. Modelled on {@link AiEvaluationProcess} per
 * ASSESSMENT_BULK_REPORT_EXPORT_ARCHITECTURE.md §4.3, with one deliberate
 * divergence: no JPA associations to Assessment/StudentAttempt. The worker
 * thread reads this row outside any request-scoped session, and the export
 * package is meant to be a leaf consumer of the report stack (never the
 * reverse) — plain String ids keep it that way and avoid any lazy-loading
 * trap on a detached entity read on a background thread.
 */
@Entity
@Table(name = "assessment_report_export_job")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentReportExportJob {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "assessment_id", nullable = false)
    private String assessmentId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "created_by_user_id", nullable = false)
    private String createdByUserId;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "total_count", nullable = false)
    @Builder.Default
    private Integer totalCount = 0;

    @Column(name = "completed_count", nullable = false)
    @Builder.Default
    private Integer completedCount = 0;

    @Column(name = "failed_count", nullable = false)
    @Builder.Default
    private Integer failedCount = 0;

    @Column(name = "skipped_count", nullable = false)
    @Builder.Default
    private Integer skippedCount = 0;

    @Column(name = "regenerate", nullable = false)
    @Builder.Default
    private Boolean regenerate = false;

    @Column(name = "output_file_id")
    private String outputFileId;

    @Column(name = "output_file_name")
    private String outputFileName;

    @Column(name = "output_size_bytes")
    private Long outputSizeBytes;

    @Column(name = "request_json", columnDefinition = "TEXT")
    private String requestJson;

    @Column(name = "context_snapshot", columnDefinition = "TEXT")
    private String contextSnapshot;

    @Column(name = "context_snapshot_version")
    private Integer contextSnapshotVersion;

    @Column(name = "context_drift", nullable = false)
    @Builder.Default
    private Boolean contextDrift = false;

    @Column(name = "superseded_file_ids", columnDefinition = "TEXT")
    private String supersededFileIds;

    @Column(name = "resume_count", nullable = false)
    @Builder.Default
    private Integer resumeCount = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "started_at")
    private Date startedAt;

    @Column(name = "completed_at")
    private Date completedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    // Deliberately updatable (unlike the createdAt/updatedAt pattern on
    // AiEvaluationProcess): Postgres has no ON UPDATE trigger for this table
    // (plan R5), and this column drives the /status staleness detection
    // (ARCHITECTURE.md §8.5). Every JPA write path that should bump it
    // (finalizeJob, persistSnapshot) sets it explicitly; the native
    // claimForRun/checkpoint queries already set it via now().
    @Column(name = "updated_at")
    private Date updatedAt;
}
