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
}
