package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * One student's row within a bulk report export job. See
 * AssessmentReportExportJob for why {@code jobId}/{@code attemptId} are
 * plain String columns rather than {@code @ManyToOne} associations.
 */
@Entity
@Table(name = "assessment_report_export_item")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssessmentReportExportItem {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "job_id", nullable = false)
    private String jobId;

    @Column(name = "attempt_id", nullable = false)
    private String attemptId;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "source", length = 20)
    private String source;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "zip_entry_name")
    private String zipEntryName;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private Integer retryCount = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "processed_at")
    private Date processedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}
