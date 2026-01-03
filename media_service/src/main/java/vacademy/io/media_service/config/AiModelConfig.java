package vacademy.io.media_service.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Configuration properties for AI model settings.
 * Allows externalization of model names, retry configs, and timeout settings.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "ai")
public class AiModelConfig {

    /**
     * Default model to use when none specified by frontend
     */
    private String defaultModel = "google/gemini-2.5-flash";

    /**
     * List of allowed models that frontend can request
     */
    private List<String> allowedModels = List.of(
            "google/gemini-2.5-flash",
            "google/gemini-2.0-flash",
            "openai/gpt-4o-mini",
            "openai/gpt-4o",
            "anthropic/claude-3-haiku",
            "anthropic/claude-3-sonnet",
            "deepseek/deepseek-chat",
            "mistralai/mistral-large");

    /**
     * Fallback models to try when primary model fails
     */
    private List<String> fallbackModels = List.of(
            "google/gemini-2.5-flash",
            "openai/gpt-4o-mini",
            "deepseek/deepseek-chat");

    /**
     * Maximum retry attempts for AI calls
     */
    private int maxRetryAttempts = 5;

    /**
     * Default timeout in milliseconds for AI API calls
     */
    private int defaultTimeoutMs = 30000;

    /**
     * PDF processing configuration
     */
    private ProcessingConfig pdf = new ProcessingConfig(20, 20000);

    /**
     * Audio processing configuration
     */
    private ProcessingConfig audio = new ProcessingConfig(50, 20000);

    /**
     * Validates if the given model is allowed
     *
     * @param model The model name to validate
     * @return true if model is allowed, false otherwise
     */
    public boolean isModelAllowed(String model) {
        return model != null && allowedModels.contains(model);
    }

    /**
     * Gets the model to use, falling back to default if not allowed
     *
     * @param requestedModel The model requested by frontend
     * @return The model to use (requested if allowed, otherwise default)
     */
    public String getModelToUse(String requestedModel) {
        if (requestedModel != null && isModelAllowed(requestedModel)) {
            return requestedModel;
        }
        return defaultModel;
    }

    @Data
    public static class ProcessingConfig {
        private int maxTries;
        private int delayMs;

        public ProcessingConfig() {
            this.maxTries = 20;
            this.delayMs = 20000;
        }

        public ProcessingConfig(int maxTries, int delayMs) {
            this.maxTries = maxTries;
            this.delayMs = delayMs;
        }
    }
}
