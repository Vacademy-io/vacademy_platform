package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "ai_question_evaluation")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiQuestionEvaluation {

        @Id
        @UuidGenerator
        @Column(name = "id")
        private String id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "evaluation_process_id", nullable = false)
        private AiEvaluationProcess evaluationProcess;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "question_id", nullable = false)
        private vacademy.io.assessment_service.features.question_core.entity.Question question;

        @Column(name = "question_wise_marks_id")
        private String questionWiseMarksId;

        @Column(name = "question_number")
        private Integer questionNumber;

        // Evaluation results
        @Column(name = "evaluation_result_json", columnDefinition = "TEXT")
        private String evaluationResultJson;

        @Column(name = "marks_awarded", precision = 10, scale = 2)
        private BigDecimal marksAwarded;

        @Column(name = "max_marks", precision = 10, scale = 2)
        private BigDecimal maxMarks;

        @Column(name = "feedback", columnDefinition = "TEXT")
        private String feedback;

        @Column(name = "extracted_answer", columnDefinition = "TEXT")
        private String extractedAnswer;

        // Status tracking
        @Column(name = "status", nullable = false, length = 50)
        private String status;

        // Timestamps
        @Column(name = "started_at")
        private Date startedAt;

        @Column(name = "completed_at")
        private Date completedAt;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Date createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private Date updatedAt;
}
