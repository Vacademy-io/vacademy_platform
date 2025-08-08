package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.notification_service.features.announcements.entity.*;
import vacademy.io.notification_service.features.announcements.enums.MediumType;
import vacademy.io.notification_service.features.announcements.enums.MessageStatus;
import vacademy.io.notification_service.features.announcements.repository.*;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.service.EmailService;
import vacademy.io.notification_service.service.WhatsAppService;
import vacademy.io.notification_service.features.firebase_notifications.service.PushNotificationService;
import vacademy.io.common.auth.entity.User;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnnouncementDeliveryService {

    private final RecipientMessageRepository recipientMessageRepository;
    private final AnnouncementMediumRepository mediumRepository;
    private final AnnouncementRepository announcementRepository;
    private final RichTextDataRepository richTextDataRepository;
    private final NotificationLogRepository notificationLogRepository;
    
    // Existing notification services
    private final EmailService emailService;
    private final WhatsAppService whatsAppService;
    private final PushNotificationService pushNotificationService;
    
    // Service clients for user resolution
    private final AuthServiceClient authServiceClient;
    
    // Configuration for batch processing
    @Value("${notification.user.batch.size:100}")
    private int userBatchSize;

    /**
     * Deliver announcement via all configured mediums
     */
    @Transactional
    public void deliverAnnouncement(String announcementId) {
        log.info("Starting delivery for announcement: {}", announcementId);
        
        try {
            // Get announcement details
            Announcement announcement = announcementRepository.findById(announcementId)
                    .orElseThrow(() -> new RuntimeException("Announcement not found: " + announcementId));
            
            // Get content
            RichTextData content = richTextDataRepository.findById(announcement.getRichTextId())
                    .orElseThrow(() -> new RuntimeException("Content not found for announcement: " + announcementId));
            
            // Get all mediums configured for this announcement
            List<AnnouncementMedium> mediums = mediumRepository.findByAnnouncementIdAndIsActive(announcementId, true);
            
            // Get all pending recipient messages
            List<RecipientMessage> pendingMessages = recipientMessageRepository
                    .findByAnnouncementIdAndStatus(announcementId, MessageStatus.PENDING);
            
            // Deliver via each medium
            for (AnnouncementMedium medium : mediums) {
                deliverViaMedium(announcement, content, medium, pendingMessages);
            }
            
            log.info("Completed delivery for announcement: {}", announcementId);
            
        } catch (Exception e) {
            log.error("Error delivering announcement: {}", announcementId, e);
            throw new RuntimeException("Failed to deliver announcement: " + e.getMessage(), e);
        }
    }

    /**
     * Deliver announcement via specific medium (Email, WhatsApp, Push)
     */
    private void deliverViaMedium(Announcement announcement, RichTextData content, 
                                 AnnouncementMedium medium, List<RecipientMessage> pendingMessages) {
        
        log.debug("Delivering announcement {} via medium: {}", announcement.getId(), medium.getMediumType());
        
        switch (medium.getMediumType()) {
            case EMAIL:
                deliverViaEmail(announcement, content, medium, pendingMessages);
                break;
                
            case WHATSAPP:
                deliverViaWhatsApp(announcement, content, medium, pendingMessages);
                break;
                
            case PUSH_NOTIFICATION:
                deliverViaPushNotification(announcement, content, medium, pendingMessages);
                break;
                
            default:
                log.warn("Unknown medium type: {}", medium.getMediumType());
        }
    }

    /**
     * Deliver via Email using existing EmailService
     */
    private void deliverViaEmail(Announcement announcement, RichTextData content, 
                                AnnouncementMedium medium, List<RecipientMessage> pendingMessages) {
        
        Map<String, Object> emailConfig = medium.getMediumConfig();
        String subject = (String) emailConfig.getOrDefault("subject", announcement.getTitle());
        String template = (String) emailConfig.getOrDefault("template", "announcement_email");
        
        for (RecipientMessage message : pendingMessages) {
            try {
                // Update message status
                message.setMediumType(MediumType.EMAIL);
                message.setStatus(MessageStatus.SENT);
                message.setSentAt(LocalDateTime.now());
                
                // Get user email - this would need to be resolved from user service
                String userEmail = resolveUserEmail(message.getUserId());
                if (userEmail != null) {
                    // Send email using existing service
                    emailService.sendHtmlEmail(userEmail, subject, "announcement-service", content.getContent());
                    
                    message.setStatus(MessageStatus.DELIVERED);
                    message.setDeliveredAt(LocalDateTime.now());
                    
                    // Create notification log entry
                    createNotificationLog(announcement, message, "EMAIL", "SUCCESS", null);
                    
                } else {
                    message.setStatus(MessageStatus.FAILED);
                    message.setErrorMessage("User email not found");
                    createNotificationLog(announcement, message, "EMAIL", "FAILED", "User email not found");
                }
                
                recipientMessageRepository.save(message);
                
            } catch (Exception e) {
                log.error("Error sending email for message: {}", message.getId(), e);
                message.setStatus(MessageStatus.FAILED);
                message.setErrorMessage(e.getMessage());
                recipientMessageRepository.save(message);
                createNotificationLog(announcement, message, "EMAIL", "FAILED", e.getMessage());
            }
        }
    }

    /**
     * Deliver via WhatsApp using existing WhatsAppService
     */
    private void deliverViaWhatsApp(Announcement announcement, RichTextData content, 
                                   AnnouncementMedium medium, List<RecipientMessage> pendingMessages) {
        
        Map<String, Object> whatsAppConfig = medium.getMediumConfig();
        String templateName = (String) whatsAppConfig.get("template_name");
        @SuppressWarnings("unchecked")
        Map<String, String> dynamicValues = (Map<String, String>) whatsAppConfig.get("dynamic_values");
        
        if (templateName == null) {
            log.error("WhatsApp template name not configured for announcement: {}", announcement.getId());
            return;
        }
        
        for (RecipientMessage message : pendingMessages) {
            try {
                // Update message status
                message.setMediumType(MediumType.WHATSAPP);
                message.setStatus(MessageStatus.SENT);
                message.setSentAt(LocalDateTime.now());
                
                // Get user phone - this would need to be resolved from user service
                String userPhone = resolveUserPhone(message.getUserId());
                if (userPhone != null) {
                    // Prepare dynamic values with user-specific data
                    Map<String, String> userSpecificValues = prepareDynamicValues(dynamicValues, message, announcement, content);
                    
                    // Send WhatsApp using existing service
                    // Note: This is a simplified call - actual implementation would need proper parameter mapping
                    Map<String, Map<String, String>> bodyParams = Map.of(userPhone, userSpecificValues);
                    whatsAppService.sendWhatsappMessages(templateName, List.of(bodyParams), null, "en", null);
                    
                    message.setStatus(MessageStatus.DELIVERED);
                    message.setDeliveredAt(LocalDateTime.now());
                    
                    createNotificationLog(announcement, message, "WHATSAPP", "SUCCESS", null);
                    
                } else {
                    message.setStatus(MessageStatus.FAILED);
                    message.setErrorMessage("User phone not found");
                    createNotificationLog(announcement, message, "WHATSAPP", "FAILED", "User phone not found");
                }
                
                recipientMessageRepository.save(message);
                
            } catch (Exception e) {
                log.error("Error sending WhatsApp for message: {}", message.getId(), e);
                message.setStatus(MessageStatus.FAILED);
                message.setErrorMessage(e.getMessage());
                recipientMessageRepository.save(message);
                createNotificationLog(announcement, message, "WHATSAPP", "FAILED", e.getMessage());
            }
        }
    }

    /**
     * Deliver via Push Notification using existing PushNotificationService
     */
    private void deliverViaPushNotification(Announcement announcement, RichTextData content, 
                                           AnnouncementMedium medium, List<RecipientMessage> pendingMessages) {
        
        Map<String, Object> pushConfig = medium.getMediumConfig();
        String title = (String) pushConfig.getOrDefault("title", announcement.getTitle());
        String body = (String) pushConfig.getOrDefault("body", getContentPreview(content.getContent()));
        @SuppressWarnings("unchecked")
        Map<String, String> customData = (Map<String, String>) pushConfig.getOrDefault("custom_data", new HashMap<>());
        
        // Add announcement-specific data
        customData.put("announcement_id", announcement.getId());
        customData.put("type", "announcement");
        
        for (RecipientMessage message : pendingMessages) {
            try {
                // Update message status
                message.setMediumType(MediumType.PUSH_NOTIFICATION);
                message.setStatus(MessageStatus.SENT);
                message.setSentAt(LocalDateTime.now());
                
                // Send push notification using existing service
                pushNotificationService.sendNotificationToUser(message.getUserId(), title, body, customData);
                
                message.setStatus(MessageStatus.DELIVERED);
                message.setDeliveredAt(LocalDateTime.now());
                
                createNotificationLog(announcement, message, "PUSH_NOTIFICATION", "SUCCESS", null);
                recipientMessageRepository.save(message);
                
            } catch (Exception e) {
                log.error("Error sending push notification for message: {}", message.getId(), e);
                message.setStatus(MessageStatus.FAILED);
                message.setErrorMessage(e.getMessage());
                recipientMessageRepository.save(message);
                createNotificationLog(announcement, message, "PUSH_NOTIFICATION", "FAILED", e.getMessage());
            }
        }
    }

    // Helper methods
    private void createNotificationLog(Announcement announcement, RecipientMessage message, 
                                     String notificationType, String status, String errorMessage) {
        NotificationLog log = new NotificationLog();
        log.setNotificationType(notificationType);
        log.setChannelId(message.getUserId());
        log.setBody(announcement.getTitle());
        log.setSource("announcement-service");
        log.setSourceId(announcement.getId());
        log.setUserId(message.getUserId());
        log.setNotificationDate(LocalDateTime.now());
        
        // You might want to add status and error message fields to NotificationLog entity
        notificationLogRepository.save(log);
    }

    private String resolveUserEmail(String userId) {
        log.debug("Resolving email for user: {}", userId);
        
        try {
            List<User> users = authServiceClient.getUsersByIds(List.of(userId));
            if (!users.isEmpty()) {
                User user = users.get(0);
                String email = user.getEmail();
                log.debug("Resolved email for user {}: {}", userId, email != null ? "***@***.***" : "null");
                return email;
            } else {
                log.warn("No user found with ID: {}", userId);
                return null;
            }
        } catch (Exception e) {
            log.error("Error resolving email for user: {}", userId, e);
            return null;
        }
    }

    private String resolveUserPhone(String userId) {
        log.debug("Resolving phone for user: {}", userId);
        
        try {
            List<User> users = authServiceClient.getUsersByIds(List.of(userId));
            if (!users.isEmpty()) {
                User user = users.get(0);
                String phone = user.getMobileNumber();
                log.debug("Resolved phone for user {}: {}", userId, phone != null ? "***-***-****" : "null");
                return phone;
            } else {
                log.warn("No user found with ID: {}", userId);
                return null;
            }
        } catch (Exception e) {
            log.error("Error resolving phone for user: {}", userId, e);
            return null;
        }
    }

    /**
     * Batch resolve user contact information for optimization
     */
    private Map<String, User> batchResolveUsers(List<String> userIds) {
        log.debug("Batch resolving contact info for {} users", userIds.size());
        
        Map<String, User> userMap = new HashMap<>();
        
        try {
            // Use batched approach for better performance
            List<User> users = authServiceClient.getUsersByIdsInBatches(userIds, userBatchSize);
            
            for (User user : users) {
                userMap.put(user.getId(), user);
            }
            
            log.debug("Successfully resolved contact info for {} out of {} users", userMap.size(), userIds.size());
            
        } catch (Exception e) {
            log.error("Error batch resolving user contact info", e);
        }
        
        return userMap;
    }

    private Map<String, String> prepareDynamicValues(Map<String, String> template, RecipientMessage message, 
                                                    Announcement announcement, RichTextData content) {
        Map<String, String> values = new HashMap<>();
        
        if (template != null) {
            for (Map.Entry<String, String> entry : template.entrySet()) {
                String value = entry.getValue();
                
                // Replace placeholders with actual values
                value = value.replace("{{title}}", announcement.getTitle());
                value = value.replace("{{content}}", getContentPreview(content.getContent()));
                value = value.replace("{{created_by}}", announcement.getCreatedByName() != null ? 
                        announcement.getCreatedByName() : announcement.getCreatedBy());
                value = value.replace("{{user_name}}", message.getUserName() != null ? 
                        message.getUserName() : message.getUserId());
                
                values.put(entry.getKey(), value);
            }
        }
        
        return values;
    }

    private String getContentPreview(String content) {
        if (content == null) return "";
        
        // Strip HTML tags for preview
        String preview = content.replaceAll("<[^>]*>", "");
        
        // Limit to 100 characters
        if (preview.length() > 100) {
            preview = preview.substring(0, 97) + "...";
        }
        
        return preview;
    }
}