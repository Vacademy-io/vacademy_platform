package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Learner-safe projection of {@link vacademy.io.common.meeting.dto.MeetingRecordingDTO}.
 *
 * Never carries {@code downloadUrl} or any other provider-host URL — see
 * docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md section A3 for the
 * sanitization rules and the S3 > YOUTUBE > ZOOM_CLOUD > BBB selection order.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LearnerRecordingDTO {

    private String recordingId;

    /** S3 | YOUTUBE | ZOOM_CLOUD | BBB */
    private String playbackType;

    /**
     * Playback URL. For YOUTUBE this is the watch URL; for ZOOM_CLOUD/BBB it's
     * the provider's playback page. Null for S3 (the FE resolves the public
     * media-service URL itself from {@link #fileId} via the existing
     * getPublicUrl flow) and null when a ZOOM_CLOUD recording has expired.
     */
    private String url;

    /** Vacademy media-service file id — set only when playbackType == S3. */
    private String fileId;

    /** Recording-level passcode — only meaningful for ZOOM_CLOUD. */
    private String passcode;

    /** ISO-8601 provider auto-delete timestamp — only meaningful for ZOOM_CLOUD. */
    private String expiresAt;

    /** True when a ZOOM_CLOUD recording's expiresAt is already in the past; url/passcode omitted in that case. */
    private Boolean expired;

    private Long durationSeconds;

    /** e.g. "content" / "webcams" / "full" — lets the FE label "Part 1/2" for multi-part recordings. */
    private String partLabel;
}
