package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
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

        @Column(name = "started_at")
        private Date startedAt;

        @Column(name = "completed_at")
        private Date completedAt;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Date createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private Date updatedAt;
}
