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
 * Sidecar translation of one {@code assessment_rich_text_data} row into one
 * locale. The canonical row is NEVER copied or mutated — delivery swaps the
 * translated {@code content} into the response DTO when a servable
 * (PUBLISHED/STALE) row exists, and falls back to the canonical content
 * per-item otherwise. {@code richTextId} references
 * {@code assessment_rich_text_data.id} by convention (no FK).
 */
@Entity
@Table(name = "rich_text_translation")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class RichTextTranslation {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "rich_text_id", nullable = false)
    private String richTextId;

    /** BCP-47 primary subtag, e.g. "ar" (see LocaleRegistry). */
    @Column(name = "locale", nullable = false)
    private String locale;

    /** Translated text/HTML — same format as the canonical row's {@code type}. */
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /** DRAFT | IN_REVIEW | PUBLISHED | STALE (TranslationState). */
    @Column(name = "state", nullable = false)
    private String state;

    @Column(name = "source_locale", nullable = false)
    private String sourceLocale;

    /** sha256 of the canonical content this row was translated from (staleness detection). */
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
