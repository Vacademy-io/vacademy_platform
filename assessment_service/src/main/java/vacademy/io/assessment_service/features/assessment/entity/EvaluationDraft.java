package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.EvaluationDraftDto;

import java.util.Date;

/**
 * An in-progress ("draft") manual evaluation of a student's answer sheet. Holds the
 * whole editable evaluator state (Fabric annotations per page, awarded marks,
 * per-question feedback, elapsed time, current page) as a JSON blob so a faculty can
 * pause and resume grading from any device — without flattening/re-uploading a PDF.
 * One draft per (attempt, evaluator); removed once marks are submitted.
 */
@Entity
@Table(name = "evaluation_draft")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class EvaluationDraft {
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "attempt_id")
    private String attemptId;

    @Column(name = "assessment_id")
    private String assessmentId;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "evaluator_user_id")
    private String evaluatorUserId;

    @Column(name = "draft_json", columnDefinition = "TEXT")
    private String draftJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    // Managed in the service on each upsert so it reflects the last save time.
    @Column(name = "updated_at")
    private Date updatedAt;

    public EvaluationDraftDto toDto() {
        return EvaluationDraftDto.builder()
                .id(this.id)
                .attemptId(this.attemptId)
                .assessmentId(this.assessmentId)
                .instituteId(this.instituteId)
                .evaluatorUserId(this.evaluatorUserId)
                .draftJson(this.draftJson)
                .updatedAt(this.updatedAt)
                .build();
    }
}
