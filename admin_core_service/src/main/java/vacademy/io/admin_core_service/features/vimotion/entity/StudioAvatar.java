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

    @Column(name = "face_image_url", nullable = false)
    private String faceImageUrl;

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
