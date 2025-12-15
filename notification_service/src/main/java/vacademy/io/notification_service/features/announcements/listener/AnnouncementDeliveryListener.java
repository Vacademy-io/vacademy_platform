package vacademy.io.notification_service.features.announcements.listener;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vacademy.io.notification_service.features.announcements.event.AnnouncementDeliveryEvent;
import vacademy.io.notification_service.features.announcements.service.AnnouncementDeliveryService;

/**
 * Listens for announcement delivery events and triggers async delivery
 * Uses @TransactionalEventListener to ensure delivery happens AFTER transaction commits
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AnnouncementDeliveryListener {
    
    private final AnnouncementDeliveryService deliveryService;
    
    /**
     * Handle announcement delivery event
     * Triggered AFTER the transaction commits (TransactionPhase.AFTER_COMMIT)
     * Runs asynchronously in background thread pool
     * 
     * This ensures:
     * 1. Announcement and RecipientMessages are committed to database
     * 2. Async thread can read the committed data
     * 3. HTTP request returns immediately without waiting for delivery
     */
    @Async("announcementDeliveryExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAnnouncementDelivery(AnnouncementDeliveryEvent event) {
        String announcementId = event.getAnnouncementId();
        log.info("Received announcement delivery event for: {}", announcementId);
        
        try {
            deliveryService.deliverAnnouncement(announcementId);
        } catch (Exception e) {
            log.error("Error in async announcement delivery for: {}", announcementId, e);
            // TODO: Implement retry logic or dead letter queue
        }
    }
}

