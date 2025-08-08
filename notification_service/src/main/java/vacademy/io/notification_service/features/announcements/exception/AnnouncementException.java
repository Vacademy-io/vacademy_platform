package vacademy.io.notification_service.features.announcements.exception;

/**
 * Base exception class for announcement-related errors
 */
public class AnnouncementException extends RuntimeException {
    
    private final String errorCode;
    private final Object details;
    
    public AnnouncementException(String message) {
        super(message);
        this.errorCode = "ANNOUNCEMENT_ERROR";
        this.details = null;
    }
    
    public AnnouncementException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
        this.details = null;
    }
    
    public AnnouncementException(String message, String errorCode, Object details) {
        super(message);
        this.errorCode = errorCode;
        this.details = details;
    }
    
    public AnnouncementException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "ANNOUNCEMENT_ERROR";
        this.details = null;
    }
    
    public AnnouncementException(String message, String errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.details = null;
    }
    
    public String getErrorCode() {
        return errorCode;
    }
    
    public Object getDetails() {
        return details;
    }
}