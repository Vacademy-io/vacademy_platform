package vacademy.io.admin_core_service.features.coding_submission.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "coding_submissions")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CodingSubmission {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "slide_id", nullable = false)
    private String slideId;

    @Column(name = "learner_id", nullable = false)
    private String learnerId;

    @Column(name = "package_session_id")
    private String packageSessionId;

    @Column(name = "language", nullable = false, length = 50)
    private String language;

    @Column(name = "source_code", nullable = false, columnDefinition = "TEXT")
    private String sourceCode;

    @Column(name = "verdict", nullable = false, length = 32)
    private String verdict;

    @Column(name = "passed_count", nullable = false)
    private Integer passedCount;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount;

    @Column(name = "score", nullable = false)
    private Double score;

    @Column(name = "max_points", nullable = false)
    private Double maxPoints;

    /**
     * JSON array of per-testcase results. Stored as TEXT — the controller
     * receives it as a JSON string from the client and persists verbatim.
     */
    @Column(name = "testcase_results_json", columnDefinition = "TEXT")
    private String testcaseResultsJson;

    @Column(name = "total_time_ms", nullable = false)
    private Integer totalTimeMs;

    @Column(name = "peak_memory_kb", nullable = false)
    private Integer peakMemoryKb;

    @Column(name = "submitted_at", nullable = false)
    private Date submittedAt;

    @Column(name = "session_started_at")
    private Date sessionStartedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
