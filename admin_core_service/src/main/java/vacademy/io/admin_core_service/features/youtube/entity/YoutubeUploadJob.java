package vacademy.io.admin_core_service.features.youtube.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "youtube_upload_job")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class YoutubeUploadJob {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "session_schedule_id", nullable = false)
    private String sessionScheduleId;

    @Column(name = "recording_id")
    private String recordingId;

    /** Vacademy media-service fileId — the S3-backed MP4 to upload. */
    @Column(name = "recording_file_id", nullable = false)
    private String recordingFileId;

    /** QUEUED | UPLOADING | DONE | FAILED | CANCELLED */
    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "youtube_video_id", length = 64)
    private String youtubeVideoId;

    @Column(name = "youtube_video_url", columnDefinition = "TEXT")
    private String youtubeVideoUrl;

    @Column(name = "title", columnDefinition = "TEXT")
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "privacy_status", length = 16)
    private String privacyStatus;

    @Column(name = "attempts", nullable = false)
    private Integer attempts;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts;

    @Column(name = "next_retry_at")
    private Date nextRetryAt;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    /** e.g. "quotaExceeded", "invalidGrant", "forbidden" — drives retry policy. */
    @Column(name = "last_error_code", length = 64)
    private String lastErrorCode;

    @Column(name = "triggered_by_user_id")
    private String triggeredByUserId;

    /** AUTO (post-publish hook) | MANUAL (admin/teacher button) */
    @Column(name = "triggered_via", nullable = false, length = 16)
    private String triggeredVia;

    @Column(name = "started_at")
    private Date startedAt;

    @Column(name = "finished_at")
    private Date finishedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
