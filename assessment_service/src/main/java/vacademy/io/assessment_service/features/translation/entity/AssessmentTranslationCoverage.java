package vacademy.io.assessment_service.features.translation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Per-assessment, per-locale rollup of how many rich-text strings are
 * PUBLISHED, so admin UIs can show translation coverage without a fan-out
 * count on every load. Recomputed by the internal batch-upsert endpoint
 * whenever a batch arrives with an assessment_id.
 */
@Entity
@Table(name = "assessment_translation_coverage")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AssessmentTranslationCoverage {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "assessment_id", nullable = false)
    private String assessmentId;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "published_count", nullable = false)
    private Integer publishedCount;

    // Managed in the service on each recompute.
    @Column(name = "updated_at")
    private Date updatedAt;
}
