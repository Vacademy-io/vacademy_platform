package vacademy.io.admin_core_service.features.translation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Sidecar translation of a rich_text_data row: one row per (rich_text_id,
 * locale). The canonical rich_text_data row is never modified; learner delivery
 * COALESCEs this row's content over the canonical content when the requested
 * locale matches and state is learner-visible (PUBLISHED / STALE).
 */
@Entity
@Table(name = "rich_text_translation")
@Getter
@Setter
public class RichTextTranslation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "rich_text_id", nullable = false)
    private String richTextId;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "type")
    private String type;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "state", nullable = false)
    private String state;

    @Column(name = "source_locale", nullable = false)
    private String sourceLocale;

    @Column(name = "source_hash")
    private String sourceHash;

    @Column(name = "translated_by")
    private String translatedBy;

    @Column(name = "reviewed_by")
    private String reviewedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
