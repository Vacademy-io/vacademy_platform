package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * DTO for AI processing requests.
 * Allows frontend to specify model preferences and other processing options.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiProcessingRequest {

    /**
     * Preferred AI model to use (optional).
     * If not specified or not allowed, default model will be used.
     * Examples: "google/gemini-2.5-flash", "openai/gpt-4o-mini",
     * "deepseek/deepseek-chat"
     */
    private String preferredModel;

    /**
     * Maximum number of retry attempts (optional).
     * If not specified, default from config will be used.
     */
    private Integer maxRetries;

    /**
     * Timeout in milliseconds (optional).
     * If not specified, default from config will be used.
     */
    private Integer timeoutMs;

    /**
     * Additional processing options that can be passed to the AI service.
     */
    private Map<String, Object> options;

    /**
     * Whether to enable fallback to other models on failure.
     * Default is true.
     */
    private Boolean enableFallback;

    /**
     * Priority level for processing (LOW, NORMAL, HIGH).
     * Higher priority tasks may be processed before lower priority ones.
     */
    private String priority;

    public boolean isFallbackEnabled() {
        return enableFallback == null || enableFallback;
    }
}
