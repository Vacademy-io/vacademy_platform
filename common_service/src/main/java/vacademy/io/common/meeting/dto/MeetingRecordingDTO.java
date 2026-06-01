package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MeetingRecordingDTO {
    private String recordingId;
    /** Direct download URL for the recording */
    private String downloadUrl;
    /** Embed/playback URL (e.g. Zoho viewer URL) */
    private String playbackUrl;
    private long durationSeconds;
    /** ISO-8601 string */
    private String startTime;
    private String providerMeetingId;
    /** Vacademy media service file ID (set when recording is uploaded to S3) */
    private String fileId;
    /** Recording type: "content" (screen share / camera-as-content), "webcams" (participants), "full" (legacy single) */
    private String type;
    /** BBB internal meeting ID — used as recordID in BBB deleteRecordings API */
    private String bbbInternalId;
    /** YouTube video ID — set after the recording has been uploaded to the institute's channel */
    private String youtubeVideoId;
    /** Resolved YouTube watch URL (https://www.youtube.com/watch?v=...) for convenience */
    private String youtubeVideoUrl;
    /**
     * ISO-8601 timestamp when the provider will auto-delete this recording
     * (e.g. Zoom's default 30-day cloud retention). Null when the provider has
     * no expiry (BBB-hosted) or once the recording is mirrored to our S3
     * (fileId set). Drives "expires in N days" warnings in the admin UI.
     */
    private String expiresAt;
    /**
     * Recording-level passcode. For Zoom, cloud recordings have their own passcode
     * (not the meeting passcode) and Zoom prompts for it on play_url. Shown in the
     * admin UI as a fallback when the embedded ?pwd= parameter is rejected.
     */
    private String passcode;
    /**
     * Where the recording currently lives: "ZOOM_CLOUD" (provider cloud, subject to
     * the provider's auto-delete via {@link #expiresAt}) or "S3" (mirrored to
     * Vacademy storage, permanent — {@link #fileId} set, {@link #expiresAt} cleared).
     * Null for legacy rows. Drives the storage badge + "Sync to S3" affordance.
     */
    private String recordingStorage;
}
