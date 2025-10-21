package vacademy.io.notification_service.features.email_tracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.email_tracking.dto.UserEmailTrackingRequest;
import vacademy.io.notification_service.features.email_tracking.dto.UserEmailTrackingResponse;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for tracking user emails and their delivery/engagement status
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailTrackingService {
    
    private final NotificationLogRepository notificationLogRepository;
    
    /**
     * Get paginated list of emails sent to a user with their latest tracking status
     */
    @Transactional(readOnly = true)
    public Page<UserEmailTrackingResponse> getUserEmails(UserEmailTrackingRequest request) {
        log.info("Fetching emails for user: {} or email: {}", request.getUserId(), request.getEmail());
        
        try {
            // Validate request
            if ((request.getUserId() == null || request.getUserId().isBlank()) 
                && (request.getEmail() == null || request.getEmail().isBlank())) {
                throw new IllegalArgumentException("Either userId or email must be provided");
            }
            
            // Create pageable
            Pageable pageable = PageRequest.of(
                request.getPage() != null ? request.getPage() : 0,
                request.getSize() != null ? request.getSize() : 20
            );
            
            // Fetch emails based on userId or email
            Page<NotificationLog> emailLogs;
            if (request.getUserId() != null && !request.getUserId().isBlank()) {
                emailLogs = notificationLogRepository.findEmailsByUserId(request.getUserId(), pageable);
            } else {
                emailLogs = notificationLogRepository.findEmailsByChannelId(request.getEmail(), pageable);
            }
            
            log.info("Found {} emails for the request", emailLogs.getTotalElements());
            
            // Convert to response DTOs with tracking information
            List<UserEmailTrackingResponse> responses = emailLogs.getContent().stream()
                .map(this::mapToTrackingResponse)
                .collect(Collectors.toList());
            
            return new PageImpl<>(responses, pageable, emailLogs.getTotalElements());
            
        } catch (Exception e) {
            log.error("Error fetching user emails: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to fetch user emails: " + e.getMessage(), e);
        }
    }
    
    /**
     * Map NotificationLog to UserEmailTrackingResponse with latest tracking status
     */
    private UserEmailTrackingResponse mapToTrackingResponse(NotificationLog emailLog) {
        UserEmailTrackingResponse response = UserEmailTrackingResponse.builder()
            .emailId(emailLog.getId())
            .recipientEmail(emailLog.getChannelId())
            .userId(emailLog.getUserId())
            .emailSubject(emailLog.getBody() != null && emailLog.getBody().length() > 100 
                ? emailLog.getBody().substring(0, 100) + "..." 
                : emailLog.getBody())
            .source(emailLog.getSource())
            .sourceId(emailLog.getSourceId())
            .sentAt(emailLog.getNotificationDate())
            .build();
        
        // Fetch latest tracking event for this email using native query
        try {
            Optional<NotificationLog> latestEventOpt = notificationLogRepository
                .findLatestEmailEventBySourceIdNative(emailLog.getId());
            
            log.debug("Email {}: Latest event query returned {} result", 
                emailLog.getId(), latestEventOpt.isPresent() ? "a" : "no");
            
            if (latestEventOpt.isPresent()) {
                NotificationLog latestEvent = latestEventOpt.get();
                response.setLatestStatus(parseEventDetails(latestEvent));
            } else {
                // No events yet - email is pending
                response.setLatestStatus(UserEmailTrackingResponse.EmailTrackingStatus.builder()
                    .eventType("pending")
                    .eventTimestamp(emailLog.getNotificationDate())
                    .eventDetails("Email sent, awaiting delivery confirmation")
                    .build());
            }
        } catch (Exception e) {
            log.warn("Error fetching latest event for email {}: {}", emailLog.getId(), e.getMessage());
            response.setLatestStatus(UserEmailTrackingResponse.EmailTrackingStatus.builder()
                .eventType("unknown")
                .eventTimestamp(emailLog.getNotificationDate())
                .eventDetails("Unable to fetch tracking status")
                .build());
        }
        
        return response;
    }
    
    /**
     * Parse event details from notification log body
     */
    private UserEmailTrackingResponse.EmailTrackingStatus parseEventDetails(NotificationLog eventLog) {
        String body = eventLog.getBody();
        String eventType = extractEventType(body);
        
        UserEmailTrackingResponse.EmailTrackingStatus.EmailTrackingStatusBuilder statusBuilder = 
            UserEmailTrackingResponse.EmailTrackingStatus.builder()
                .eventType(eventType)
                .eventTimestamp(eventLog.getUpdatedAt())
                .eventDetails(body);
        
        // Parse event-specific details based on event type
        switch (eventType) {
            case "bounce":
                statusBuilder.bounceType(extractValue(body, "Bounce Type: "));
                statusBuilder.bounceSubType(extractValue(body, "Bounce SubType: "));
                break;
                
            case "open":
                statusBuilder.ipAddress(extractValue(body, "IP Address: "));
                statusBuilder.userAgent(extractValue(body, "User Agent: "));
                break;
                
            case "click":
                statusBuilder.ipAddress(extractValue(body, "IP Address: "));
                statusBuilder.userAgent(extractValue(body, "User Agent: "));
                statusBuilder.clickedLink(extractValue(body, "Link: "));
                break;
                
            case "complaint":
                statusBuilder.complaintFeedbackType(extractValue(body, "Complaint Type: "));
                break;
                
            case "delivery":
                // Delivery details can be added if needed
                break;
        }
        
        return statusBuilder.build();
    }
    
    /**
     * Extract event type from body
     * Body format from EmailEventService: "Email Event: OPEN\n..." or "Email Event: DELIVERY\n..."
     */
    private String extractEventType(String body) {
        if (body == null || body.isEmpty()) {
            return "unknown";
        }
        
        try {
            if (body.startsWith("Email Event: ")) {
                int endIndex = body.indexOf("\n");
                if (endIndex > 0) {
                    return body.substring("Email Event: ".length(), endIndex).trim().toLowerCase();
                } else {
                    return body.substring("Email Event: ".length()).trim().toLowerCase();
                }
            }
        } catch (Exception e) {
            log.warn("Error extracting event type from body", e);
        }
        
        return "unknown";
    }
    
    /**
     * Extract a specific value from body using a prefix
     */
    private String extractValue(String body, String prefix) {
        if (body == null || !body.contains(prefix)) {
            return null;
        }
        
        try {
            int startIndex = body.indexOf(prefix);
            if (startIndex >= 0) {
                startIndex += prefix.length();
                int endIndex = body.indexOf("\n", startIndex);
                if (endIndex > 0) {
                    String value = body.substring(startIndex, endIndex).trim();
                    // Handle "null" string values from SES
                    return "null".equals(value) ? null : value;
                } else {
                    String value = body.substring(startIndex).trim();
                    return "null".equals(value) ? null : value;
                }
            }
        } catch (Exception e) {
            log.warn("Error extracting value with prefix: {}", prefix, e);
        }
        
        return null;
    }
    
    /**
     * Get tracking details for a specific email
     */
    @Transactional(readOnly = true)
    public UserEmailTrackingResponse getEmailTracking(String emailId) {
        log.info("Fetching tracking details for email: {}", emailId);
        
        try {
            NotificationLog emailLog = notificationLogRepository.findById(emailId)
                .orElseThrow(() -> new IllegalArgumentException("Email not found with ID: " + emailId));
            
            if (!"EMAIL".equals(emailLog.getNotificationType())) {
                throw new IllegalArgumentException("Invalid email ID - not an EMAIL type log");
            }
            
            return mapToTrackingResponse(emailLog);
            
        } catch (Exception e) {
            log.error("Error fetching email tracking for {}: {}", emailId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch email tracking: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get all tracking events for a specific email (full history)
     */
    @Transactional(readOnly = true)
    public List<UserEmailTrackingResponse.EmailTrackingStatus> getEmailEventHistory(String emailId) {
        log.info("Fetching full event history for email: {}", emailId);
        
        try {
            // Verify email exists
            NotificationLog emailLog = notificationLogRepository.findById(emailId)
                .orElseThrow(() -> new IllegalArgumentException("Email not found with ID: " + emailId));
            
            if (!"EMAIL".equals(emailLog.getNotificationType())) {
                throw new IllegalArgumentException("Invalid email ID - not an EMAIL type log");
            }
            
            // Get all events for this email (not just the latest)
            List<String> emailLogIds = new ArrayList<>();
            emailLogIds.add(emailId);
            
            List<NotificationLog> allEvents = notificationLogRepository.findEmailEventsBySourceIds(emailLogIds);
            
            return allEvents.stream()
                .map(this::parseEventDetails)
                .collect(Collectors.toList());
            
        } catch (Exception e) {
            log.error("Error fetching email event history for {}: {}", emailId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch email event history: " + e.getMessage(), e);
        }
    }
}

