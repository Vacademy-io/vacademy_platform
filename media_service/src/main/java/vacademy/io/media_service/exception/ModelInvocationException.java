package vacademy.io.media_service.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception for AI model invocation errors.
 */
public class ModelInvocationException extends AiProcessingException {

    public ModelInvocationException(String model, String reason) {
        super("MODEL_INVOCATION_ERROR",
                String.format("AI model '%s' failed to respond. Trying alternative...", model),
                String.format("Model %s failed: %s", model, reason));
    }

    public ModelInvocationException(String model, String reason, Throwable cause) {
        super("MODEL_INVOCATION_ERROR",
                String.format("AI model '%s' failed to respond. Please try again.", model),
                String.format("Model %s failed: %s", model, reason),
                cause);
    }

    public static ModelInvocationException noResponse(String model) {
        return new ModelInvocationException(
                "MODEL_NO_RESPONSE",
                "The AI model did not return a response. Please try again.",
                String.format("No response from model: %s", model),
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    public static ModelInvocationException invalidResponse(String model, String reason) {
        return new ModelInvocationException(
                "MODEL_INVALID_RESPONSE",
                "The AI response could not be processed. Please try again with clearer input.",
                String.format("Invalid response from model %s: %s", model, reason),
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public static ModelInvocationException timeout(String model) {
        return new ModelInvocationException(
                "MODEL_TIMEOUT",
                "The AI model took too long to respond. Please try with smaller input.",
                String.format("Model %s timed out", model),
                HttpStatus.GATEWAY_TIMEOUT);
    }

    public static ModelInvocationException allModelsFailed() {
        return new ModelInvocationException(
                "ALL_MODELS_FAILED",
                "All AI models are currently unavailable. Please try again later.",
                "All fallback models failed",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    public static ModelInvocationException modelNotAllowed(String model) {
        return new ModelInvocationException(
                "MODEL_NOT_ALLOWED",
                String.format("Model '%s' is not available. Using default model instead.", model),
                String.format("Model not in allowed list: %s", model),
                HttpStatus.BAD_REQUEST);
    }

    public ModelInvocationException(String errorCode, String userMessage, String technicalDetails, HttpStatus status) {
        super(errorCode, userMessage, technicalDetails, status);
    }
}
