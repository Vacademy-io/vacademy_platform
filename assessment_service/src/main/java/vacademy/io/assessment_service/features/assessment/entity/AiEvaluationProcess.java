package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "ai_evaluation_process")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiEvaluationProcess {

        @Id
        @UuidGenerator
        @Column(name = "id")
        private String id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "attempt_id", nullable = false)
        private StudentAttempt studentAttempt;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "assessment_id", nullable = false)
        private Assessment assessment;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "set_id")
        private AssessmentSetMapping setMapping;

        @Column(name = "status", nullable = false, length = 50)
        private String status;

        @Column(name = "current_section_id", length = 36)
        private String currentSectionId;

        @Column(name = "current_question_index")
        private Integer currentQuestionIndex;

        @Column(name = "evaluation_json", columnDefinition = "TEXT")
        private String evaluationJson;

        @Column(name = "error_message", columnDefinition = "TEXT")
        private String errorMessage;

        @Column(name = "retry_count")
        private Integer retryCount;

        @Column(name = "current_step", length = 50)
        private String currentStep;

        @Column(name = "questions_completed")
        private Integer questionsCompleted;

        @Column(name = "questions_total")
        private Integer questionsTotal;

        @Column(name = "ai_service_job_id", length = 64)
        private String aiServiceJobId;

        @Column(name = "started_at")
        private Date startedAt;

        @Column(name = "completed_at")
        private Date completedAt;

        /**
         * Which instance picked this job up, and when (V43).
         *
         * Dispatch used to be a plain in-JVM @Async call, so a pod dying between the
         * INSERT and the work starting left the job PENDING until the sweeper noticed.
         * A claim lets any replica drain the queue, and claimedAt is what makes an
         * abandoned claim recoverable rather than permanent.
         */
        @Column(name = "claimed_by", length = 120)
        private String claimedBy;

        @Column(name = "claimed_at")
        private Date claimedAt;

        /** When the staff were told this check had settled (V48); NULL = not yet. */
        @Column(name = "notified_at")
        private Date notifiedAt;

        /** The teacher who pressed "Evaluate with AI"; NULL for automatic and bulk checks. */
        @Column(name = "triggered_by", length = 255)
        private String triggeredBy;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Date createdAt;

        // A real heartbeat: every status/progress save moves it, so "no activity
        // for N minutes" can be read off this column. It used to be DB-default
        // only, which made a row's age its start time and a 200-copy bulk run
        // look stale while it was still queued.
        @UpdateTimestamp
        @Column(name = "updated_at")
        private Date updatedAt;
}
