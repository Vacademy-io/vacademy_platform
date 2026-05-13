package vacademy.io.admin_core_service.features.youtube.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

/**
 * Per-institute defaults applied to every videos.insert call. The manual
 * upload endpoint can override specific fields per request.
 */
@Entity
@Table(name = "youtube_upload_defaults")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YoutubeUploadDefaults {

    @Id
    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /** Master switch — false by default. Institute must opt in before
     *  Connect, defaults, or auto-upload are available. */
    @Column(name = "feature_enabled", nullable = false)
    private boolean featureEnabled;

    @Column(name = "auto_upload_enabled", nullable = false)
    private boolean autoUploadEnabled;

    /** public | unlisted | private */
    @Column(name = "privacy_status", nullable = false, length = 16)
    private String privacyStatus;

    @Column(name = "embeddable", nullable = false)
    private boolean embeddable;

    @Column(name = "public_stats_viewable", nullable = false)
    private boolean publicStatsViewable;

    @Column(name = "made_for_kids", nullable = false)
    private boolean madeForKids;

    /** YouTube category numeric ID as string. 27 = Education. */
    @Column(name = "category_id", nullable = false, length = 8)
    private String categoryId;

    /** youtube (Standard YouTube License) | creativeCommon */
    @Column(name = "license", nullable = false, length = 32)
    private String license;

    @Column(name = "default_language", length = 16)
    private String defaultLanguage;

    @Column(name = "tags_csv", columnDefinition = "TEXT")
    private String tagsCsv;

    @Column(name = "title_template", columnDefinition = "TEXT", nullable = false)
    private String titleTemplate;

    @Column(name = "description_template", columnDefinition = "TEXT")
    private String descriptionTemplate;

    @Column(name = "notify_subscribers", nullable = false)
    private boolean notifySubscribers;

    @Column(name = "default_playlist_id")
    private String defaultPlaylistId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
