package vacademy.io.notification_service.features.announcements.exception;

/**
 * Exception thrown when an announcement is not found
 */
public class AnnouncementNotFoundException extends AnnouncementException {
    
    public AnnouncementNotFoundException(String announcementId) {
        super("Announcement not found with ID: " + announcementId, "ANNOUNCEMENT_NOT_FOUND", announcementId);
    }
}