package vacademy.io.notification_service.features.announcements.exception;

import java.util.Map;

/**
 * Exception thrown for validation errors
 */
public class ValidationException extends AnnouncementException {
    
    public ValidationException(String message) {
        super(message, "VALIDATION_ERROR");
    }
    
    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(message, "VALIDATION_ERROR", fieldErrors);
    }
    
    public ValidationException(String field, String error) {
        super("Validation failed for field: " + field, "VALIDATION_ERROR", Map.of(field, error));
    }
}