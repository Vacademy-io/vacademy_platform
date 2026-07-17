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
 * Language-specific media asset for an owner entity: one row per (owner_type,
 * owner_id, locale, kind). kind = PRIMARY (replacement asset), CAPTION_VTT
 * (subtitles) or AUDIO_TRACK (dub). The canonical asset is never modified.
 */
@Entity
@Table(name = "media_language_variant")
@Getter
@Setter
public class MediaLanguageVariant {

    public static final String KIND_PRIMARY = "PRIMARY";

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "owner_type", nullable = false)
    private String ownerType;

    @Column(name = "owner_id", nullable = false)
    private String ownerId;

    @Column(name = "locale", nullable = false)
    private String locale;

    @Column(name = "file_id_or_url", columnDefinition = "TEXT")
    private String fileIdOrUrl;

    @Column(name = "kind", nullable = false)
    private String kind;

    @Column(name = "state", nullable = false)
    private String state;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
