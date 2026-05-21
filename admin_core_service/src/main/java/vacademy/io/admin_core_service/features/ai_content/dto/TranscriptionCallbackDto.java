package vacademy.io.admin_core_service.features.ai_content.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Body shape posted by the render worker (via ai-service's callback chain)
 * to /live-sessions/transcription/callback on terminal state.
 *
 * The worker serialises with Python snake_case (httpx.post(url, json=dict))
 * — see ai_service/render_worker/main.py :: _send_callback. We map each
 * field explicitly via @JsonProperty so Jackson's default camelCase
 * strategy doesn't silently leave fields null.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TranscriptionCallbackDto {

    @JsonProperty("job_id")
    private String jobId;

    /** completed | failed (terminal states only — intermediate states don't trigger callbacks). */
    @JsonProperty("status")
    private String status;

    @JsonProperty("duration_seconds")
    private Double durationSeconds;

    @JsonProperty("detected_language")
    private String detectedLanguage;

    @JsonProperty("language_probability")
    private Double languageProbability;

    @JsonProperty("segment_count")
    private Integer segmentCount;

    @JsonProperty("word_count")
    private Integer wordCount;

    @JsonProperty("error")
    private String error;

    /** URL maps keyed by format — { json_url, srt_url, vtt_url, txt_url }. */
    @JsonProperty("output_urls_source")
    private Map<String, String> outputUrlsSource;

    @JsonProperty("output_urls_english")
    private Map<String, String> outputUrlsEnglish;
}
