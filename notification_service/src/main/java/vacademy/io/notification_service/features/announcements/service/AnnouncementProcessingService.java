package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.entity.Announcement;
import vacademy.io.notification_service.features.announcements.entity.RecipientMessage;
import vacademy.io.notification_service.features.announcements.enums.AnnouncementStatus;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.enums.ModeType;
import vacademy.io.notification_service.features.announcements.repository.*;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.event.AnnouncementDeliveryEvent;

import java.util.ArrayList;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnnouncementProcessingService {

    private final AnnouncementRepository announcementRepository;
    private final RecipientMessageRepository recipientMessageRepository;
    private final AnnouncementMediumRepository announcementMediumRepository;
    private final RecipientResolutionService recipientResolutionService;
    private final AnnouncementEventService eventService;
    private final ApplicationEventPublisher eventPublisher;
    
    // Mode-specific repositories for checking configured modes
    private final AnnouncementSystemAlertRepository systemAlertRepository;
    private final AnnouncementDashboardPinRepository dashboardPinRepository;
    private final AnnouncementDMRepository dmRepository;
    private final AnnouncementStreamRepository streamRepository;
    private final AnnouncementResourceRepository resourceRepository;
    private final AnnouncementCommunityRepository communityRepository;
    private final AnnouncementTaskRepository taskRepository;

    /**
     * Process announcement delivery - called by both immediate and scheduled flows
     */
    @Transactional
    public void processAnnouncementDelivery(String announcementId) {
        log.info("Processing delivery for announcement: {}", announcementId);
        
        try {
            Announcement announcement = announcementRepository.findById(announcementId)
                    .orElseThrow(() -> new RuntimeException("Announcement not found: " + announcementId));
            
            // Block delivery if pending approval or rejected
            if (announcement.getStatus() == AnnouncementStatus.PENDING_APPROVAL ||
                announcement.getStatus() == AnnouncementStatus.REJECTED) {
                log.info("Announcement {} is {}. Skipping delivery.", announcementId, announcement.getStatus());
                return;
            }

            // Skip if already processed
            if (announcement.getStatus() == AnnouncementStatus.ACTIVE) {
                log.info("Announcement {} already processed, skipping", announcementId);
                return;
            }
            
            // 1. Resolve recipients to actual users
            List<String> userIds = recipientResolutionService.resolveRecipientsToUsers(announcementId);
            log.info("Resolved {} users for announcement: {}", userIds.size(), announcementId);
            
            if (userIds.isEmpty()) {
                log.warn("No users resolved for announcement: {}, marking as failed", announcementId);
                announcement.setStatus(AnnouncementStatus.INACTIVE);
                announcementRepository.save(announcement);
                return;
            }
            
            // 2. Create recipient messages for each mode
            createRecipientMessages(announcement, userIds);
            
            // 3. Publish event to trigger async delivery AFTER transaction commits
            eventPublisher.publishEvent(new AnnouncementDeliveryEvent(this, announcementId));

            // 3b. Emit SSE for new announcement to recipients
            try {
                AnnouncementEvent event = new AnnouncementEvent(EventType.NEW_ANNOUNCEMENT, announcementId, null);
                event.setModeType(ModeType.SYSTEM_ALERT);
                event.setInstituteId(announcement.getInstituteId());
                eventService.sendToAnnouncementRecipients(announcementId, event);
            } catch (Exception e) {
                log.warn("Failed to emit NEW_ANNOUNCEMENT SSE for {}", announcementId, e);
            }
            
            // 4. Update announcement status
            announcement.setStatus(AnnouncementStatus.ACTIVE);
            announcement.setUpdatedAt(LocalDateTime.now());
            announcementRepository.save(announcement);
            
            log.info("Successfully processed announcement delivery: {}", announcementId);
            
        } catch (Exception e) {
            log.error("Error processing announcement delivery: {}", announcementId, e);
            
            // Mark announcement as failed
            try {
                Announcement announcement = announcementRepository.findById(announcementId).orElse(null);
                if (announcement != null) {
                    announcement.setStatus(AnnouncementStatus.INACTIVE);
                    announcement.setUpdatedAt(LocalDateTime.now());
                    announcementRepository.save(announcement);
                }
            } catch (Exception ex) {
                log.error("Error updating announcement status to failed: {}", announcementId, ex);
            }
            
            throw new RuntimeException("Failed to process announcement delivery: " + e.getMessage(), e);
        }
    }

    /**
     * Process scheduled announcement - called by Quartz jobs
     */
    @Transactional
    public void processScheduledAnnouncement(String announcementId) {
        log.info("Processing scheduled announcement: {}", announcementId);
        
        try {
            // Use the same processing logic as immediate delivery
            processAnnouncementDelivery(announcementId);
            
        } catch (Exception e) {
            log.error("Error processing scheduled announcement: {}", announcementId, e);
            throw e; // Let the scheduler handle retry logic
        }
    }

    /**
     * Create recipient messages for each user and mode combination
     */
    private void createRecipientMessages(Announcement announcement, List<String> userIds) {
        log.debug("Creating recipient messages for announcement: {} with {} users", 
                announcement.getId(), userIds.size());
        
        // Get all modes configured for this announcement
        List<ModeType> modeTypes = getModeTypesForAnnouncement(announcement.getId());
        
        if (modeTypes.isEmpty()) {
            log.warn("No modes configured for announcement: {}, defaulting to SYSTEM_ALERT", announcement.getId());
            modeTypes = List.of(ModeType.SYSTEM_ALERT);
        }
        
        // Fetch active mediums once and create per-medium delivery records
        var activeMediums = announcementMediumRepository.findByAnnouncementIdAndIsActive(announcement.getId(), true);
        for (String userId : userIds) {
            for (ModeType modeType : modeTypes) {
                for (var medium : activeMediums) {
                    // Avoid duplicates: check any pending existing for same user+mode+medium
                    boolean exists = recipientMessageRepository
                            .findByAnnouncementIdAndStatus(announcement.getId(), MessageStatus.PENDING)
                            .stream()
                            .anyMatch(rm -> rm.getUserId().equals(userId)
                                    && rm.getModeType().equals(modeType)
                                    && rm.getMediumType() == medium.getMediumType());
                    if (!exists) {
                        RecipientMessage recipientMessage = new RecipientMessage();
                        recipientMessage.setAnnouncementId(announcement.getId());
                        recipientMessage.setUserId(userId);
                        recipientMessage.setModeType(modeType);
                        recipientMessage.setMediumType(medium.getMediumType());
                        recipientMessage.setStatus(MessageStatus.PENDING);
                        recipientMessage.setCreatedAt(LocalDateTime.now());
                        recipientMessage.setUpdatedAt(LocalDateTime.now());
                        recipientMessageRepository.save(recipientMessage);
                    }
                }
            }
        }
        
        log.debug("Created recipient messages for {} users and {} modes", userIds.size(), modeTypes.size());
    }

    /**
     * Get mode types configured for an announcement by checking mode-specific tables
     */
    private List<ModeType> getModeTypesForAnnouncement(String announcementId) {
        List<ModeType> modeTypes = new ArrayList<>();
        
        // Check each mode-specific repository to see which modes are configured
        if (!systemAlertRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.SYSTEM_ALERT);
        }
        
        if (!dashboardPinRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.DASHBOARD_PIN);
        }
        
        if (!dmRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.DM);
        }
        
        if (!streamRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.STREAM);
        }
        
        if (!resourceRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.RESOURCES);
        }
        
        if (!communityRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.COMMUNITY);
        }
        
        if (!taskRepository.findByAnnouncementIdAndIsActive(announcementId, true).isEmpty()) {
            modeTypes.add(ModeType.TASKS);
        }
        
        // If no modes are configured, default to SYSTEM_ALERT
        if (modeTypes.isEmpty()) {
            log.warn("No modes configured for announcement: {}, defaulting to SYSTEM_ALERT", announcementId);
            modeTypes.add(ModeType.SYSTEM_ALERT);
        }
        
        log.debug("Found {} mode types for announcement: {}", modeTypes.size(), announcementId);
        return modeTypes;
    }

    /**
     * Get processing statistics for an announcement
     */
    @Transactional(readOnly = true)
    public ProcessingStats getProcessingStats(String announcementId) {
        List<RecipientMessage> messages = recipientMessageRepository.findByAnnouncementId(announcementId);
        
        long total = messages.size();
        long pending = messages.stream().mapToLong(m -> m.getStatus() == MessageStatus.PENDING ? 1 : 0).sum();
        long sent = messages.stream().mapToLong(m -> m.getStatus() == MessageStatus.SENT ? 1 : 0).sum();
        long delivered = messages.stream().mapToLong(m -> m.getStatus() == MessageStatus.DELIVERED ? 1 : 0).sum();
        long failed = messages.stream().mapToLong(m -> m.getStatus() == MessageStatus.FAILED ? 1 : 0).sum();
        long read = messages.stream().mapToLong(m -> m.getStatus() == MessageStatus.READ ? 1 : 0).sum();
        
        return new ProcessingStats(total, pending, sent, delivered, failed, read);
    }

    // Helper class for statistics
    public static class ProcessingStats {
        private final long total;
        private final long pending;
        private final long sent;
        private final long delivered;
        private final long failed;
        private final long read;
        
        public ProcessingStats(long total, long pending, long sent, long delivered, long failed, long read) {
            this.total = total;
            this.pending = pending;
            this.sent = sent;
            this.delivered = delivered;
            this.failed = failed;
            this.read = read;
        }
        
        // Getters
        public long getTotal() { return total; }
        public long getPending() { return pending; }
        public long getSent() { return sent; }
        public long getDelivered() { return delivered; }
        public long getFailed() { return failed; }
        public long getRead() { return read; }
        public double getDeliveryRate() { return total > 0 ? (double) delivered / total * 100 : 0; }
        public double getReadRate() { return delivered > 0 ? (double) read / delivered * 100 : 0; }
    }
}