package vacademy.io.notification_service.features.announcements.exception;

/**
 * Exception thrown when user resolution fails
 */
public class UserResolutionException extends AnnouncementException {
    
    public UserResolutionException(String message) {
        super(message, "USER_RESOLUTION_ERROR");
    }
    
    public UserResolutionException(String message, Throwable cause) {
        super(message, "USER_RESOLUTION_ERROR", cause);
    }
    
    public UserResolutionException(String service, String operation, Throwable cause) {
        super("Failed to resolve users from " + service + " during " + operation, 
              "USER_RESOLUTION_ERROR", cause);
    }
}