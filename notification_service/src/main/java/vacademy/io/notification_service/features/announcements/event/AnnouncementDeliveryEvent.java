package vacademy.io.notification_service.features.announcements.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Event fired after announcement is successfully created and transaction committed
 * Used to trigger async delivery after data is persisted
 */
@Getter
public class AnnouncementDeliveryEvent extends ApplicationEvent {
    
    private final String announcementId;
    
    public AnnouncementDeliveryEvent(Object source, String announcementId) {
        super(source);
        this.announcementId = announcementId;
    }
}

