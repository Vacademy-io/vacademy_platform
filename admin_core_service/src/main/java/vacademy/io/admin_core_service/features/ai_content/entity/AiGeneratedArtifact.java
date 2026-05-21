package vacademy.io.admin_core_service.features.ai_content.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Final output generated from an AI content source — e.g. an assessment
 * created from a recording's transcript, or flashcards from a PDF.
 *
 * One row per (source, artifact_type, attempt). Re-generating creates a new
 * row rather than overwriting, so audit history is preserved.
 *
 * v1 only writes artifact_type='ASSESSMENT' rows. The generated content (LLM
 * output: title + questions JSON) lives in generated_content_json; the soft
 * pointer to the persisted Assessment in assessment_service goes into
 * artifact_id once the push succeeds.
 */
@Entity
@Table(name = "ai_generated_artifact")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiGeneratedArtifact {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "source_id", nullable = false)
    private String sourceId;

    /** Nullable — text-direct sources may skip the extraction step. */
    @Column(name = "extraction_id")
    private String extractionId;

    /** v1: 'ASSESSMENT'. */
    @Column(name = "artifact_type", nullable = false, length = 64)
    private String artifactType;

    /** Id of the persisted artifact in its target system (e.g. assessment.id in assessment_service). Null until push succeeds. */
    @Column(name = "artifact_id")
    private String artifactId;

    @Column(name = "artifact_url", columnDefinition = "TEXT")
    private String artifactUrl;

    /** IN_PROGRESS | COMPLETED | FAILED */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /** LLM output verbatim — { title, questions: [...] } for ASSESSMENT type. */
    @Column(name = "generated_content_json", columnDefinition = "TEXT")
    private String generatedContentJson;

    /** User-supplied params that drove generation (dates, marks, visibility, ...). */
    @Column(name = "generation_params_json", columnDefinition = "TEXT")
    private String generationParamsJson;

    @Column(name = "model_used", length = 128)
    private String modelUsed;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
