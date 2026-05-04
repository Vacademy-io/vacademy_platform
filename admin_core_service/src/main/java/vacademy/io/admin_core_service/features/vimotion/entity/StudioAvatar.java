package vacademy.io.admin_core_service.features.vimotion.entity;

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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "studio_avatar")
public class StudioAvatar {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false)
    private String name;

    // 'custom' (user-uploaded face) | 'argil' | 'veed' — determines whether
    // face_image_url or external_avatar_id is the source of truth at video-gen time.
    @Column(name = "provider", nullable = false)
    private String provider;

    // fal.ai catalog enum value when provider != 'custom'.
    @Column(name = "external_avatar_id")
    private String externalAvatarId;

    // Required only when provider='custom'.
    @Column(name = "face_image_url")
    private String faceImageUrl;

    // For 'custom': mirrors face_image_url. For built-ins: self-hosted thumbnail
    // URL (null in v1; FE shows initials in that case).
    @Column(name = "preview_image_url")
    private String previewImageUrl;

    @Column(name = "description")
    private String description;

    @Column(name = "voice_id")
    private String voiceId;

    @Column(name = "voice_provider")
    private String voiceProvider;

    @Column(name = "voice_language")
    private String voiceLanguage;

    @Column(name = "voice_gender")
    private String voiceGender;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
