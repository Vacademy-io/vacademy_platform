package vacademy.io.notification_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.dto.SesEventDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailEventService {

    private final NotificationLogRepository notificationLogRepository;

    public void processEmailEvent(SesEventDTO sesEvent) {
        try {
            if (sesEvent == null) {
                log.error("SES event is null, skipping processing");
                return;
            }

            String eventType = sesEvent.getEventType();
            String messageId = sesEvent.getMail() != null ? sesEvent.getMail().getMessageId() : "unknown";
            
            log.info("Processing SES event: {} for message: {}", eventType, messageId);

            String recipient = getRecipientFromEvent(sesEvent);
            String timestamp = getTimestampFromEvent(sesEvent);
            
            // Process all SES events (back to original working behavior)
            
            // Find original notification log ID
            String originalLogId = findOriginalNotificationLogId(recipient, timestamp);
            log.info("Original log ID found: {} for recipient: {}", originalLogId, recipient);
            
            // Create notification log entry for the email event
            NotificationLog eventLog = createEmailEventLog(eventType, messageId, recipient, timestamp, sesEvent, originalLogId);
            notificationLogRepository.save(eventLog);
            
            log.info("Successfully saved SES event to database: {} for message: {} to recipient: {} with source: {}", 
                eventType, messageId, recipient, eventLog.getSource());
            
        } catch (Exception e) {
            log.error("Error processing SES event: {} - Error: {}", 
                sesEvent != null ? sesEvent.getEventType() : "unknown", e.getMessage(), e);
        }
    }

    private String getRecipientFromEvent(SesEventDTO sesEvent) {
        if (sesEvent.getMail() != null && sesEvent.getMail().getCommonHeaders() != null) {
            String[] to = sesEvent.getMail().getCommonHeaders().getTo();
            if (to != null && to.length > 0) {
                return to[0];
            }
        }
        return "unknown";
    }

    private String getTimestampFromEvent(SesEventDTO sesEvent) {
        String timestamp = null;
        
        switch (sesEvent.getEventType()) {
            case "send":
                if (sesEvent.getSend() != null) {
                    timestamp = sesEvent.getSend().getTimestamp();
                }
                break;
            case "delivery":
                if (sesEvent.getDelivery() != null) {
                    timestamp = sesEvent.getDelivery().getTimestamp();
                }
                break;
            case "bounce":
                if (sesEvent.getBounce() != null) {
                    timestamp = sesEvent.getBounce().getTimestamp();
                }
                break;
            case "complaint":
                if (sesEvent.getComplaint() != null) {
                    timestamp = sesEvent.getComplaint().getTimestamp();
                }
                break;
            case "open":
                if (sesEvent.getOpen() != null) {
                    timestamp = sesEvent.getOpen().getTimestamp();
                }
                break;
            case "click":
                if (sesEvent.getClick() != null) {
                    timestamp = sesEvent.getClick().getTimestamp();
                }
                break;
        }
        
        return timestamp != null ? timestamp : LocalDateTime.now().toString();
    }

    private NotificationLog createEmailEventLog(String eventType, String messageId, String recipient, 
                                              String timestamp, SesEventDTO sesEvent, String originalLogId) {
        NotificationLog log = new NotificationLog();
        log.setId(UUID.randomUUID().toString());
        log.setNotificationType("EMAIL_EVENT");
        log.setChannelId(recipient);
        log.setSource(originalLogId != null ? originalLogId : "SES"); // Use original log ID as source
        log.setSourceId(messageId);
        log.setUserId(recipient); // Using recipient as userId for email events
        
        // Create detailed body with event information
        String eventDetails = createEventDetailsBody(eventType, sesEvent);
        log.setBody(eventDetails);
        
        // Parse timestamp
        try {
            LocalDateTime eventTime = LocalDateTime.parse(timestamp, DateTimeFormatter.ISO_DATE_TIME);
            log.setNotificationDate(eventTime);
        } catch (Exception e) {
            log.setNotificationDate(LocalDateTime.now());
        }
        
        return log;
    }

    private String createEventDetailsBody(String eventType, SesEventDTO sesEvent) {
        StringBuilder body = new StringBuilder();
        body.append("Email Event: ").append(eventType.toUpperCase()).append("\n");
        body.append("Message ID: ").append(sesEvent.getMail() != null ? sesEvent.getMail().getMessageId() : "unknown").append("\n");
        
        if (sesEvent.getMail() != null && sesEvent.getMail().getCommonHeaders() != null) {
            SesEventDTO.CommonHeadersDTO headers = sesEvent.getMail().getCommonHeaders();
            body.append("Subject: ").append(headers.getSubject() != null ? headers.getSubject() : "N/A").append("\n");
            
            if (headers.getFrom() != null && headers.getFrom().length > 0) {
                body.append("From: ").append(String.join(", ", headers.getFrom())).append("\n");
            }
            
            if (headers.getTo() != null && headers.getTo().length > 0) {
                body.append("To: ").append(String.join(", ", headers.getTo())).append("\n");
            }
        }
        
        // Add event-specific details
        switch (eventType) {
            case "bounce":
                if (sesEvent.getBounce() != null) {
                    body.append("Bounce Type: ").append(sesEvent.getBounce().getBounceType()).append("\n");
                    body.append("Bounce SubType: ").append(sesEvent.getBounce().getBounceSubType()).append("\n");
                }
                break;
            case "complaint":
                if (sesEvent.getComplaint() != null) {
                    body.append("Complaint Type: ").append(sesEvent.getComplaint().getComplaintFeedbackType()).append("\n");
                }
                break;
            case "open":
                if (sesEvent.getOpen() != null) {
                    body.append("IP Address: ").append(sesEvent.getOpen().getIpAddress()).append("\n");
                    body.append("User Agent: ").append(sesEvent.getOpen().getUserAgent()).append("\n");
                }
                break;
            case "click":
                if (sesEvent.getClick() != null) {
                    body.append("IP Address: ").append(sesEvent.getClick().getIpAddress()).append("\n");
                    body.append("User Agent: ").append(sesEvent.getClick().getUserAgent()).append("\n");
                    body.append("Link: ").append(sesEvent.getClick().getLink()).append("\n");
                }
                break;
            case "delivery":
                if (sesEvent.getDelivery() != null) {
                    body.append("Processing Time: ").append(sesEvent.getDelivery().getProcessingTimeMillis()).append("ms\n");
                    body.append("SMTP Response: ").append(sesEvent.getDelivery().getSmtpResponse()).append("\n");
                }
                break;
        }
        
        return body.toString();
    }
    
    // All duplicate checking logic completely removed
    
    private String findOriginalNotificationLogId(String recipient, String timestamp) {
        try {
            // Step 1: Look for exact recipient match
            Optional<NotificationLog> exactMatch = notificationLogRepository
                .findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(recipient, "EMAIL");
            
            if (exactMatch.isPresent()) {
                String logId = exactMatch.get().getId();
                log.info("Found exact match EMAIL log ID: '{}' for recipient: '{}'", logId, recipient);
                return logId;
            }
            
            // Step 2: If no exact match, look for recent EMAIL logs (within last hour)
            // Sometimes there might be slight differences in email format
            LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
            Optional<NotificationLog> recentEmailLog = notificationLogRepository
                .findTopByNotificationTypeAndNotificationDateAfterOrderByNotificationDateDesc("EMAIL", oneHourAgo);
            
            if (recentEmailLog.isPresent()) {
                String logId = recentEmailLog.get().getId();
                log.info("Using recent EMAIL log ID: '{}' (no exact recipient match for '{}')", logId, recipient);
                return logId;
            }
            
            log.info("No EMAIL log found for recipient: '{}' - using 'SES' as source", recipient);
            return null; // Will result in source = "SES"
            
        } catch (Exception e) {
            log.error("Error finding original notification log: {}", e.getMessage(), e);
            return null;
        }
    }
}
