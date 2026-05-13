package vacademy.io.admin_core_service.features.youtube.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

/**
 * One row per institute. Stores the OAuth refresh token (encrypted) granted
 * by the institute admin so the worker can mint access tokens on demand and
 * upload to the institute's own YouTube channel.
 */
@Entity
@Table(name = "institute_youtube_credentials")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstituteYoutubeCredentials {

    @Id
    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT", nullable = false)
    private String refreshTokenEncrypted;

    @Column(name = "channel_id")
    private String channelId;

    @Column(name = "channel_title", length = 512)
    private String channelTitle;

    @Column(name = "channel_thumbnail_url", columnDefinition = "TEXT")
    private String channelThumbnailUrl;

    @Column(name = "scopes", columnDefinition = "TEXT")
    private String scopes;

    @Column(name = "connected_by_user_id")
    private String connectedByUserId;

    /** ACTIVE | INVALID — flipped to INVALID when refresh fails with invalid_grant. */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "last_validated_at")
    private Date lastValidatedAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
