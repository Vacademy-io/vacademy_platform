package vacademy.io.media_service.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.ApiErrorResponse;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Exception handler for the media service.
 * Provides consistent error responses across all endpoints.
 * 
 * Named differently from common_service's GlobalExceptionHandler to avoid bean
 * conflicts.
 */
@Slf4j
@RestControllerAdvice(basePackages = "vacademy.io.media_service")
public class MediaServiceExceptionHandler {

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    /**
     * Handles VacademyException (legacy exceptions)
     */
    @ExceptionHandler(VacademyException.class)
    public ResponseEntity<ApiErrorResponse> handleVacademyException(
            VacademyException ex, HttpServletRequest request) {

        String traceId = generateTraceId();
        log.error("[{}] Vacademy Exception: {}", traceId, ex.getMessage(), ex);

        HttpStatus status = ex.getStatus() != null ? ex.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

        ApiErrorResponse response = ApiErrorResponse.builder()
                .errorCode("VACADEMY_ERROR")
                .message(ex.getMessage())
                .details(isDevProfile() ? ex.getMessage() : null)
                .status(status.value())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .traceId(traceId)
                .retryable(true)
                .build();

        return new ResponseEntity<>(response, status);
    }

    /**
     * Handles validation errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        String traceId = generateTraceId();

        StringBuilder message = new StringBuilder("Validation failed: ");
        ex.getBindingResult().getFieldErrors().forEach(error -> message.append(error.getField())
                .append(" - ")
                .append(error.getDefaultMessage())
                .append("; "));

        log.warn("[{}] Validation Error: {}", traceId, message);

        ApiErrorResponse response = ApiErrorResponse.builder()
                .errorCode("VALIDATION_ERROR")
                .message(message.toString())
                .status(HttpStatus.BAD_REQUEST.value())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .traceId(traceId)
                .retryable(false)
                .suggestion("Please check your input and try again.")
                .build();

        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handles missing request parameters
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParameter(
            MissingServletRequestParameterException ex, HttpServletRequest request) {

        String traceId = generateTraceId();
        log.warn("[{}] Missing Parameter: {}", traceId, ex.getParameterName());

        ApiErrorResponse response = ApiErrorResponse.builder()
                .errorCode("MISSING_PARAMETER")
                .message(String.format("Required parameter '%s' is missing.", ex.getParameterName()))
                .status(HttpStatus.BAD_REQUEST.value())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .traceId(traceId)
                .retryable(false)
                .suggestion("Please provide all required parameters.")
                .build();

        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handles file size exceeded errors
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUploadSize(
            MaxUploadSizeExceededException ex, HttpServletRequest request) {

        String traceId = generateTraceId();
        log.warn("[{}] File size exceeded", traceId);

        ApiErrorResponse response = ApiErrorResponse.builder()
                .errorCode("FILE_TOO_LARGE")
                .message("The uploaded file exceeds the maximum allowed size.")
                .status(HttpStatus.PAYLOAD_TOO_LARGE.value())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .traceId(traceId)
                .retryable(false)
                .suggestion("Please upload a smaller file (max 50MB).")
                .build();

        return new ResponseEntity<>(response, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    /**
     * Handles all other exceptions
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGenericException(
            Exception ex, HttpServletRequest request) {

        String traceId = generateTraceId();
        log.error("[{}] Unexpected Error: {}", traceId, ex.getMessage(), ex);

        ApiErrorResponse response = ApiErrorResponse.builder()
                .errorCode("INTERNAL_ERROR")
                .message("An unexpected error occurred. Please try again later.")
                .details(isDevProfile() ? ex.getMessage() : null)
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .timestamp(LocalDateTime.now())
                .path(request.getRequestURI())
                .traceId(traceId)
                .retryable(true)
                .suggestion("If the problem persists, please contact support.")
                .build();

        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private String generateTraceId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private boolean isDevProfile() {
        return "dev".equalsIgnoreCase(activeProfile) ||
                "local".equalsIgnoreCase(activeProfile) ||
                "default".equalsIgnoreCase(activeProfile);
    }
}
