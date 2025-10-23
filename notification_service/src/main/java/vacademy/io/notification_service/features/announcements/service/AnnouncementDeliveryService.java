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
                deliverViaEmail(announcement, content, medium, pendingMessages,announcement.getInstituteId());
                break;
                
            case WHATSAPP:
                deliverViaWhatsApp(announcement, content, medium, pendingMessages,announcement.getInstituteId());
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
                                AnnouncementMedium medium, List<RecipientMessage> pendingMessages,String instituteId) {
        
        Map<String, Object> emailConfig = medium.getMediumConfig();
        String subject = (String) emailConfig.getOrDefault("subject", announcement.getTitle());
        String template = (String) emailConfig.getOrDefault("template", "announcement_email");
        String forceToEmail = (String) emailConfig.get("force_to_email");
        String fromEmail = (String) emailConfig.get("fromEmail");
        String fromName = (String) emailConfig.get("fromName");
        String emailType = (String) emailConfig.get("emailType");
        
        log.info("Delivering announcement {} via email with type: {}, from: {}, subject: {}", 
                 announcement.getId(), emailType, fromEmail, subject);
        
        for (RecipientMessage message : pendingMessages) {
            if (message.getMediumType() != null && message.getMediumType() != MediumType.EMAIL) continue; // skip others
            try {
                // Update message status
                message.setMediumType(MediumType.EMAIL);
                message.setStatus(MessageStatus.SENT);
                message.setSentAt(LocalDateTime.now());
                
                // Get user email - this would need to be resolved from user service
                String userEmail = forceToEmail != null && !forceToEmail.isBlank() ? forceToEmail : resolveUserEmail(message.getUserId());
                if (userEmail != null) {
                    // Process HTML content with variables (similar to WhatsApp)
                    String processedContent = processHtmlVariables(content.getContent(), message, announcement);
                    
                    // Send email using existing service with email type, custom from address, and name
                    emailService.sendHtmlEmail(userEmail, subject, "announcement-service", processedContent, 
                                             instituteId, fromEmail, fromName, emailType);
                    
                    message.setStatus(MessageStatus.DELIVERED);
                    message.setDeliveredAt(LocalDateTime.now());
                    
                    // Create email-specific notification log entry
                    createEmailNotificationLog(announcement, message, userEmail, "SUCCESS", null);
                    
                } else {
                    message.setStatus(MessageStatus.FAILED);
                    message.setErrorMessage("User email not found");
                    createEmailNotificationLog(announcement, message, "unknown@email.com", "FAILED", "User email not found");
                }
                
                recipientMessageRepository.save(message);
                
            } catch (Exception e) {
                String detailed = extractSmtpDetails(e);
                log.error("Error sending email for message: {} -> {}", message.getId(), detailed, e);
                message.setStatus(MessageStatus.FAILED);
                message.setErrorMessage(detailed);
                recipientMessageRepository.save(message);
                createEmailNotificationLog(announcement, message, "error@email.com", "FAILED", detailed);
            }
        }
    }

    /**
     * Deliver via WhatsApp using existing WhatsAppService
     */
    private void deliverViaWhatsApp(Announcement announcement, RichTextData content, 
                                   AnnouncementMedium medium, List<RecipientMessage> pendingMessages,String instituteId) {
        
        Map<String, Object> whatsAppConfig = medium.getMediumConfig();
        String templateName = (String) whatsAppConfig.get("template_name");
        @SuppressWarnings("unchecked")
        Map<String, String> dynamicValues = (Map<String, String>) whatsAppConfig.get("dynamic_values");
        
        if (templateName == null) {
            log.error("WhatsApp template name not configured for announcement: {}", announcement.getId());
            return;
        }
        
        for (RecipientMessage message : pendingMessages) {
            if (message.getMediumType() != null && message.getMediumType() != MediumType.WHATSAPP) continue; // skip others
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
                    whatsAppService.sendWhatsappMessages(templateName, List.of(bodyParams), null, "en", null,instituteId);
                    
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
            if (message.getMediumType() != null && message.getMediumType() != MediumType.PUSH_NOTIFICATION) continue; // skip others
            try {
                // Update message status
                message.setMediumType(MediumType.PUSH_NOTIFICATION);
                message.setStatus(MessageStatus.SENT);
                message.setSentAt(LocalDateTime.now());
                
                // Send push notification using institute-specific Firebase
                pushNotificationService.sendNotificationToUser(announcement.getInstituteId(), message.getUserId(), title, body, customData);
                
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
        log.setChannelId(message.getUserId()); // This will be updated to email address
        log.setBody(announcement.getTitle());
        log.setSource("announcement-service");
        log.setSourceId(announcement.getId());
        log.setUserId(message.getUserId());
        log.setNotificationDate(LocalDateTime.now());
        
        notificationLogRepository.save(log);
    }
    
    // Enhanced method for email-specific logging
    private void createEmailNotificationLog(Announcement announcement, RecipientMessage message, 
                                          String userEmail, String status, String errorMessage) {
        NotificationLog log = new NotificationLog();
        log.setNotificationType("EMAIL");
        log.setChannelId(userEmail); // Use email address as channelId for email tracking
        log.setBody(announcement.getTitle());
        log.setSource("announcement-service");
        log.setSourceId(announcement.getId());
        log.setUserId(message.getUserId()); // Keep user ID for reference
        log.setNotificationDate(LocalDateTime.now());
        
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

    /**
     * Attempt to extract SMTP response codes and detailed reasons from nested exceptions
     * so operators can query precise failure reasons from recipient_messages.error_message.
     */
    private String extractSmtpDetails(Throwable throwable) {
        StringBuilder sb = new StringBuilder();
        Throwable t = throwable;
        int depth = 0;
        while (t != null && depth < 10) { // avoid deep cycles
            String cls = t.getClass().getName();
            String msg = t.getMessage();
            if (sb.length() == 0) {
                sb.append(cls).append(": ").append(msg);
            }
            // Try common Jakarta Mail SMTP exceptions for return code
            try {
                if (cls.contains("com.sun.mail.smtp.SMTPSendFailedException") || cls.contains("com.sun.mail.smtp.SMTPAddressFailedException")) {
                    // reflectively extract getReturnCode if present
                    try {
                        java.lang.reflect.Method m = t.getClass().getMethod("getReturnCode");
                        Object rc = m.invoke(t);
                        sb.append(" | SMTP returnCode=").append(rc);
                    } catch (Exception ignore) { }
                    try {
                        java.lang.reflect.Method m2 = t.getClass().getMethod("getCommand");
                        Object cmd = m2.invoke(t);
                        if (cmd != null) sb.append(" | cmd=").append(cmd);
                    } catch (Exception ignore) { }
                }
                // MessagingException.getNextException()
                if (t instanceof jakarta.mail.MessagingException me) {
                    Exception next = me.getNextException();
                    if (next != null) {
                        sb.append(" | next=").append(next.getClass().getName()).append(": ").append(next.getMessage());
                    }
                }
            } catch (Throwable ignore) { }
            t = t.getCause();
            depth++;
        }
        if (sb.length() == 0) {
            sb.append(throwable.toString());
        }
        return sb.toString();
    }

    /**
     * Process HTML content with variable replacement (similar to WhatsApp)
     */
    private String processHtmlVariables(String htmlContent, RecipientMessage message, Announcement announcement) {
        if (htmlContent == null || htmlContent.isEmpty()) {
            return htmlContent;
        }
        
        String processedContent = htmlContent;
        
        // Replace common variables
        processedContent = processedContent.replace("{{title}}", 
            announcement.getTitle() != null ? announcement.getTitle() : "");
        
        processedContent = processedContent.replace("{{content}}", 
            getContentPreview(announcement.getTitle())); // Or use actual content preview
        
        processedContent = processedContent.replace("{{created_by}}", 
            announcement.getCreatedByName() != null ? announcement.getCreatedByName() : 
            (announcement.getCreatedBy() != null ? announcement.getCreatedBy() : ""));
        
        // Resolve user name properly - try to get from user details first
        String resolvedUserName = resolveUserName(message);
        
        processedContent = processedContent.replace("{{user_name}}", resolvedUserName);
        
        // Add support for {{name}} as alias for {{user_name}}
        processedContent = processedContent.replace("{{name}}", resolvedUserName);
        
        // Add more variables as needed
        processedContent = processedContent.replace("{{institute_id}}", 
            announcement.getInstituteId() != null ? announcement.getInstituteId() : "");
        
        processedContent = processedContent.replace("{{announcement_id}}", 
            announcement.getId() != null ? announcement.getId() : "");
        
        // Add user-specific variables (resolve user details)
        try {
            User user = resolveUserDetails(message.getUserId());
            if (user != null) {
                processedContent = processedContent.replace("{{user_email}}", 
                    user.getEmail() != null ? user.getEmail() : "");
                processedContent = processedContent.replace("{{user_phone}}", 
                    user.getMobileNumber() != null ? user.getMobileNumber() : "");
                   // Extract first and last name from fullName
                   String fullName = user.getFullName() != null ? user.getFullName() : "";
                   String[] nameParts = fullName.split(" ", 2);
                   String firstName = nameParts.length > 0 ? nameParts[0] : "";
                   String lastName = nameParts.length > 1 ? nameParts[1] : "";
                   
                   processedContent = processedContent.replace("{{user_first_name}}", firstName);
                   processedContent = processedContent.replace("{{user_last_name}}", lastName);
                   
                   // Add support for common aliases
                   processedContent = processedContent.replace("{{first_name}}", firstName);
                   processedContent = processedContent.replace("{{last_name}}", lastName);
                   processedContent = processedContent.replace("{{full_name}}", fullName);
            }
        } catch (Exception e) {
            log.warn("Could not resolve user details for variable replacement: {}", message.getUserId(), e);
        }
        
        return processedContent;
    }

    /**
     * Resolve user details for variable replacement
     */
    private User resolveUserDetails(String userId) {
        try {
            List<User> users = authServiceClient.getUsersByIds(List.of(userId));
            return users.isEmpty() ? null : users.get(0);
        } catch (Exception e) {
            log.error("Error resolving user details for ID: {}", userId, e);
            return null;
        }
    }
    
    /**
     * Resolve user name for variable replacement
     * Tries multiple sources: message userName, user fullName, user email, userId
     */
    private String resolveUserName(RecipientMessage message) {
        // First try message.getUserName()
        if (message.getUserName() != null && !message.getUserName().trim().isEmpty()) {
            return message.getUserName();
        }
        
        // If not available, try to resolve from user details
        try {
            User user = resolveUserDetails(message.getUserId());
            if (user != null) {
                // Try fullName first
                if (user.getFullName() != null && !user.getFullName().trim().isEmpty()) {
                    return user.getFullName();
                }
                // Fall back to email
                if (user.getEmail() != null && !user.getEmail().trim().isEmpty()) {
                    return user.getEmail();
                }
            }
        } catch (Exception e) {
            log.warn("Could not resolve user name for user ID: {}", message.getUserId(), e);
        }
        
        // Final fallback to userId
        return message.getUserId() != null ? message.getUserId() : "";
    }
}