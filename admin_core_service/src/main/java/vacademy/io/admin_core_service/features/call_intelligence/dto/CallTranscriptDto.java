package vacademy.io.admin_core_service.features.call_intelligence.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Full transcript of one analyzed call, resolved server-side from the S3
 * artifacts the transcription pipeline wrote (source_text_key /
 * english_text_key). Proxied through the API so the browser never needs
 * direct S3 access.
 */
@Data
@Builder
public class CallTranscriptDto {

    private String callLogId;
    private String detectedLanguage;

    /** Transcript in the spoken language (hi/en/mixed). Null if unavailable. */
    private String sourceText;

    /** English translation pass. Null if unavailable. */
    private String englishText;
}
