package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Standardized error response for API errors.
 * Provides structured error information for frontend consumption.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiErrorResponse {

    /**
     * Unique error code for categorizing errors
     */
    private String errorCode;

    /**
     * User-friendly error message to display
     */
    private String message;

    /**
     * Technical details for debugging (only in non-production)
     */
    private String details;

    /**
     * HTTP status code
     */
    private int status;

    /**
     * Timestamp when the error occurred
     */
    private LocalDateTime timestamp;

    /**
     * Request path that caused the error
     */
    private String path;

    /**
     * Trace ID for log correlation
     */
    private String traceId;

    /**
     * Suggested action for the user
     */
    private String suggestion;

    /**
     * Whether the operation can be retried
     */
    private Boolean retryable;

    /**
     * Creates a simple error response
     */
    public static ApiErrorResponse of(String errorCode, String message, int status) {
        return ApiErrorResponse.builder()
                .errorCode(errorCode)
                .message(message)
                .status(status)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Creates a detailed error response
     */
    public static ApiErrorResponse detailed(String errorCode, String message, String details, int status, String path) {
        return ApiErrorResponse.builder()
                .errorCode(errorCode)
                .message(message)
                .details(details)
                .status(status)
                .timestamp(LocalDateTime.now())
                .path(path)
                .build();
    }

    /**
     * Creates a retryable error response
     */
    public static ApiErrorResponse retryable(String errorCode, String message, String suggestion, int status) {
        return ApiErrorResponse.builder()
                .errorCode(errorCode)
                .message(message)
                .suggestion(suggestion)
                .status(status)
                .timestamp(LocalDateTime.now())
                .retryable(true)
                .build();
    }
}
