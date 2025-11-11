package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.audience.dto.AudienceResponseDTO;

import java.sql.Timestamp;

/**
 * Entity representing a Lead/Response submission to an Audience Campaign
 * Captures leads from multiple sources (website forms, Google Ads, Facebook Ads, etc.)
 */
@Entity
@Table(name = "audience_response")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudienceResponse {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "audience_id", nullable = false)
    private String audienceId;

    @Column(name = "user_id")
    private String userId; // NULL until converted to student (references auth_service.users)

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType; // WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, LINKEDIN_ADS, etc.

    @Column(name = "source_id", length = 100)
    private String sourceId; // Landing page ID, Ad campaign ID, etc.

    @Column(name = "submitted_at", insertable = false, updatable = false)
    private Timestamp submittedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    /**
     * Constructor from DTO
     */
    public AudienceResponse(AudienceResponseDTO dto) {
        this.id = dto.getId();
        this.audienceId = dto.getAudienceId();
        this.userId = dto.getUserId();
        this.sourceType = dto.getSourceType();
        this.sourceId = dto.getSourceId();
    }
}

