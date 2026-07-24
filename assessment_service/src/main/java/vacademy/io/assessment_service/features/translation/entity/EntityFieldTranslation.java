package vacademy.io.assessment_service.features.translation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/**
 * Sidecar translation of one plain (non-rich-text) entity field into one
 * locale — e.g. {@code section.name}. Upsert key:
 * (entity_type, entity_id, field, locale). The canonical entity ids are
 * referenced by convention (no FK).
 */
@Entity
@Table(name = "entity_field_translation")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class EntityFieldTranslation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    /** Canonical entity type, e.g. "SECTION", "ASSESSMENT". */
    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private String entityId;

    /** Canonical field name on that entity, e.g. "name". */
    @Column(name = "field", nullable = false)
    private String field;

    /** BCP-47 primary subtag, e.g. "ar" (see LocaleRegistry). */
    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /** Optional structured payload (JSON string persisted as jsonb). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "json_value")
    private String jsonValue;

    /** DRAFT | IN_REVIEW | PUBLISHED | STALE (TranslationState). */
    @Column(name = "state", nullable = false)
    private String state;

    @Column(name = "source_locale", nullable = false)
    private String sourceLocale;

    @Column(name = "source_hash")
    private String sourceHash;

    /** "AI:&lt;model&gt;" or "USER:&lt;id&gt;". */
    @Column(name = "translated_by")
    private String translatedBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    // Managed in the service on each upsert so it reflects the last write.
    @Column(name = "updated_at")
    private Date updatedAt;
}
