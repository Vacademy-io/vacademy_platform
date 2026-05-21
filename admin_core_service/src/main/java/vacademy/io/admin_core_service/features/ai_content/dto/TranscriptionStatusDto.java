package vacademy.io.admin_core_service.features.ai_content.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Projection returned to the admin dashboard for a single recording's
 * transcription state. Combines the source + extraction rows into one
 * compact payload the UI can render directly.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TranscriptionStatusDto {

    /** BBB recordingId — echoed back so the UI can correlate. */
    private String recordingId;

    /** QUEUED | RUNNING | COMPLETED | FAILED — or null when no extraction row exists yet. */
    private String status;

    /** Render-worker job id (handy for support / debugging). */
    private String jobId;

    private String detectedLanguage;
    private Double languageProbability;
    private Double durationSeconds;
    private Integer segmentCount;
    private Integer wordCount;

    private String sourceTextUrl;
    private String englishTextUrl;

    /** Non-null when status='FAILED'. */
    private String errorMessage;

    private Date createdAt;
    private Date updatedAt;
}
