package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.entity.Announcement;
import vacademy.io.notification_service.features.announcements.entity.RecipientMessage;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.event.AnnouncementDeliveryEvent;
import vacademy.io.notification_service.features.announcements.repository.AnnouncementRepository;
import vacademy.io.notification_service.features.announcements.repository.RecipientMessageRepository;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Service for recovering/restarting announcement deliveries
 * Handles server crashes, stuck messages, and manual restarts
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnnouncementRecoveryService {
    
    private final AnnouncementRepository announcementRepository;
    private final RecipientMessageRepository recipientMessageRepository;
    private final ApplicationEventPublisher eventPublisher;
    
    /**
     * Restart announcement delivery for a specific announcement
     * Reuses existing delivery flow - just resets stuck/pending messages
     * 
     * Note: Delivery happens asynchronously via event publisher, but this method
     * returns synchronously to provide immediate feedback to the caller.
     * 
     * @param announcementId The announcement to restart
     * @return Map with recovery statistics
     */
    @Transactional
    public Map<String, Object> restartAnnouncement(String announcementId) {
        log.info("Starting restart process for announcement: {}", announcementId);
        
        Map<String, Object> result = new HashMap<>();
        result.put("announcementId", announcementId);
        result.put("startedAt", LocalDateTime.now());
        
        try {
            // 1. Verify announcement exists
            Announcement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new RuntimeException("Announcement not found: " + announcementId));
            
            result.put("announcementStatus", announcement.getStatus().name());
            
            // 2. Reset stuck SENT messages (older than 5 minutes)
            LocalDateTime stuckCutoff = LocalDateTime.now().minusMinutes(5);
            List<RecipientMessage> stuckMessages = recipientMessageRepository
                .findByAnnouncementIdAndStatusAndSentAtBefore(
                    announcementId, 
                    MessageStatus.SENT, 
                    stuckCutoff
                );
            
            int stuckCount = stuckMessages.size();
            for (RecipientMessage message : stuckMessages) {
                log.info("Resetting stuck SENT message {} back to PENDING for retry", message.getId());
                message.setStatus(MessageStatus.PENDING);
                message.setSentAt(null);
                message.setErrorMessage("Reset during announcement restart - was stuck in SENT status");
                recipientMessageRepository.save(message);
            }
            
            result.put("stuckMessagesReset", stuckCount);
            
            // 3. Count pending messages
            long pendingCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.PENDING);
            
            result.put("pendingMessages", pendingCount);
            
            // 4. Count already delivered messages
            long deliveredCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.DELIVERED);
            
            result.put("deliveredMessages", deliveredCount);
            
            // 5. Count failed messages
            long failedCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.FAILED);
            
            result.put("failedMessages", failedCount);
            
            if (pendingCount == 0) {
                log.info("No pending messages for announcement: {}, restart not needed", announcementId);
                result.put("status", "NO_ACTION_NEEDED");
                result.put("message", "No pending messages to deliver");
                return result;
            }
            
            log.info("Restarting delivery for announcement: {} with {} pending messages", 
                announcementId, pendingCount);
            
            // 6. Trigger delivery by publishing event (reuses existing delivery flow!)
            // This ensures proper transaction handling and async execution
            eventPublisher.publishEvent(new AnnouncementDeliveryEvent(this, announcementId));
            
            result.put("status", "RESTARTED");
            result.put("message", "Delivery restarted for " + pendingCount + " pending messages");
            log.info("Successfully triggered restart for announcement: {}", announcementId);
            
        } catch (Exception e) {
            log.error("Error restarting announcement: {}", announcementId, e);
            result.put("status", "ERROR");
            result.put("error", e.getMessage());
        }
        
        result.put("completedAt", LocalDateTime.now());
        return result;
    }
    
    /**
     * Get recovery status for an announcement
     * Shows counts of messages in different states
     * 
     * @param announcementId The announcement to check
     * @return Map with status breakdown
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getRecoveryStatus(String announcementId) {
        log.debug("Getting recovery status for announcement: {}", announcementId);
        
        Map<String, Object> status = new HashMap<>();
        status.put("announcementId", announcementId);
        
        try {
            // Verify announcement exists
            Announcement announcement = announcementRepository.findById(announcementId)
                .orElseThrow(() -> new RuntimeException("Announcement not found: " + announcementId));
            
            status.put("announcementStatus", announcement.getStatus().name());
            status.put("createdAt", announcement.getCreatedAt());
            
            // Get message counts by status
            long pendingCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.PENDING);
            long sentCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.SENT);
            long deliveredCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.DELIVERED);
            long failedCount = recipientMessageRepository
                .countByAnnouncementIdAndStatus(announcementId, MessageStatus.FAILED);
            long totalCount = recipientMessageRepository.countByAnnouncementId(announcementId);
            
            status.put("totalMessages", totalCount);
            status.put("pending", pendingCount);
            status.put("sent", sentCount);
            status.put("delivered", deliveredCount);
            status.put("failed", failedCount);
            
            // Find stuck SENT messages (older than 5 minutes)
            LocalDateTime stuckCutoff = LocalDateTime.now().minusMinutes(5);
            List<RecipientMessage> stuckMessages = recipientMessageRepository
                .findByAnnouncementIdAndStatusAndSentAtBefore(
                    announcementId, 
                    MessageStatus.SENT, 
                    stuckCutoff
                );
            
            status.put("stuckMessages", stuckMessages.size());
            
            // Calculate progress percentage
            if (totalCount > 0) {
                double progressPercentage = (deliveredCount * 100.0) / totalCount;
                status.put("progressPercentage", String.format("%.2f", progressPercentage));
            } else {
                status.put("progressPercentage", "0.00");
            }
            
            // Determine if restart is needed
            boolean restartNeeded = pendingCount > 0 || stuckMessages.size() > 0;
            status.put("restartNeeded", restartNeeded);
            
            if (restartNeeded) {
                status.put("restartReason", buildRestartReason(pendingCount, stuckMessages.size()));
            }
            
        } catch (Exception e) {
            log.error("Error getting recovery status for announcement: {}", announcementId, e);
            status.put("error", e.getMessage());
        }
        
        return status;
    }
    
    /**
     * Auto-recover incomplete deliveries on application startup
     * Finds announcements with pending/stuck messages and restarts them
     */
    @Transactional
    public void autoRecoverOnStartup() {
        log.info("Checking for incomplete announcement deliveries to auto-recover...");
        
        try {
            // Find announcements with pending messages (recent ones only - last 7 days)
            LocalDateTime recentCutoff = LocalDateTime.now().minusDays(7);
            List<String> announcementIdsToRecover = new ArrayList<>();
            
            // Find announcements with PENDING messages
            List<RecipientMessage> pendingMessages = recipientMessageRepository
                .findByStatusAndCreatedAtAfter(MessageStatus.PENDING, recentCutoff);
            
            Set<String> pendingAnnouncementIds = new HashSet<>();
            pendingMessages.forEach(m -> pendingAnnouncementIds.add(m.getAnnouncementId()));
            
            // Find announcements with stuck SENT messages (older than 5 minutes)
            LocalDateTime stuckCutoff = LocalDateTime.now().minusMinutes(5);
            List<RecipientMessage> stuckMessages = recipientMessageRepository
                .findByStatusAndSentAtBeforeAndCreatedAtAfter(
                    MessageStatus.SENT, 
                    stuckCutoff,
                    recentCutoff
                );
            
            Set<String> stuckAnnouncementIds = new HashSet<>();
            stuckMessages.forEach(m -> stuckAnnouncementIds.add(m.getAnnouncementId()));
            
            // Combine unique announcement IDs
            announcementIdsToRecover.addAll(pendingAnnouncementIds);
            announcementIdsToRecover.addAll(stuckAnnouncementIds);
            
            if (announcementIdsToRecover.isEmpty()) {
                log.info("No incomplete announcements found. Auto-recovery not needed.");
                return;
            }
            
            log.info("Found {} announcements to auto-recover: pending={}, stuck={}", 
                announcementIdsToRecover.size(), pendingAnnouncementIds.size(), stuckAnnouncementIds.size());
            
            // Recover each announcement
            for (String announcementId : announcementIdsToRecover) {
                try {
                    log.info("Auto-recovering announcement: {}", announcementId);
                    restartAnnouncement(announcementId);
                } catch (Exception e) {
                    log.error("Failed to auto-recover announcement: {}", announcementId, e);
                }
            }
            
            log.info("Auto-recovery completed for {} announcements", announcementIdsToRecover.size());
            
        } catch (Exception e) {
            log.error("Error during auto-recovery on startup", e);
        }
    }
    
    /**
     * Build restart reason message
     */
    private String buildRestartReason(long pendingCount, int stuckCount) {
        List<String> reasons = new ArrayList<>();
        
        if (pendingCount > 0) {
            reasons.add(pendingCount + " pending messages");
        }
        
        if (stuckCount > 0) {
            reasons.add(stuckCount + " stuck messages (>5 min in SENT status)");
        }
        
        return String.join(", ", reasons);
    }
}

