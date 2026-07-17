package vacademy.io.admin_core_service.features.translation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;

/**
 * Sidecar translation of a plain entity column (e.g. slide.title,
 * slide.description): one row per (entity_type, entity_id, field, locale).
 * The canonical row is never modified.
 */
@Entity
@Table(name = "entity_field_translation")
@Getter
@Setter
public class EntityFieldTranslation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private String entityId;

    @Column(name = "field", nullable = false)
    private String field;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "json_value")
    @JdbcTypeCode(SqlTypes.JSON)
    private String jsonValue;

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
