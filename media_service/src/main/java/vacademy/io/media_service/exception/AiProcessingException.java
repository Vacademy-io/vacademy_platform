package vacademy.io.media_service.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base exception for AI processing errors.
 * Provides structured error information for frontend consumption.
 */
@Getter
public class AiProcessingException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus httpStatus;
    private final String userMessage;
    private final String technicalDetails;

    public AiProcessingException(String message) {
        super(message);
        this.errorCode = "AI_PROCESSING_ERROR";
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        this.userMessage = "An error occurred while processing your request. Please try again.";
        this.technicalDetails = message;
    }

    public AiProcessingException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "AI_PROCESSING_ERROR";
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        this.userMessage = "An error occurred while processing your request. Please try again.";
        this.technicalDetails = message + " - " + (cause != null ? cause.getMessage() : "");
    }

    public AiProcessingException(String errorCode, String userMessage, String technicalDetails) {
        super(technicalDetails);
        this.errorCode = errorCode;
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        this.userMessage = userMessage;
        this.technicalDetails = technicalDetails;
    }

    public AiProcessingException(String errorCode, String userMessage, String technicalDetails, HttpStatus httpStatus) {
        super(technicalDetails);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.userMessage = userMessage;
        this.technicalDetails = technicalDetails;
    }

    public AiProcessingException(String errorCode, String userMessage, String technicalDetails, Throwable cause) {
        super(technicalDetails, cause);
        this.errorCode = errorCode;
        this.httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        this.userMessage = userMessage;
        this.technicalDetails = technicalDetails;
    }
}
