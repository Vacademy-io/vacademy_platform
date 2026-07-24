package vacademy.io.admin_core_service.features.translation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Per-(package_session, locale) counter of learner-visible translation rows.
 * A locale is offered to learners (available_languages) when its
 * published_count is > 0. Maintained incrementally by the batch-upsert and
 * state-change flows.
 */
@Entity
@Table(name = "content_translation_coverage")
@Getter
@Setter
public class ContentTranslationCoverage {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "package_session_id", nullable = false)
    private String packageSessionId;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "published_count", nullable = false)
    private Integer publishedCount = 0;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
