package vacademy.io.notification_service.features.combot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.notification_service.features.combot.constants.CombotConstants;
import vacademy.io.notification_service.features.combot.constants.CombotWebhookKeys;
import vacademy.io.notification_service.features.combot.dto.TrackingRequest;
import vacademy.io.notification_service.features.combot.dto.WhatsAppTemplateRequest;
import vacademy.io.notification_service.features.combot.entity.EngagementTriggerConfig;
import vacademy.io.notification_service.features.combot.enums.WhatsAppMessageType;
import vacademy.io.notification_service.features.combot.repository.EngagementTriggerConfigRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Service for processing engagement-based triggers
 * Handles inline trigger checking when tracking events are logged
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementTriggerService {

    private final EngagementTriggerConfigRepository triggerConfigRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final CombotWebhookService webhookService;
    private final CombotMessagingService messagingService;
    private final ObjectMapper objectMapper;

    /**
     * Check and trigger engagement-based messages inline
     * Called after each tracking event is logged
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkAndTriggerEngagement(TrackingRequest request) {
        try {
            // Validate request
            if (request.getSourceId() == null || request.getChannelId() == null) {
                log.debug("Skipping engagement check - missing sourceId or channelId");
                return;
            }

            // Extract source type from notification type (e.g., "VIDEO_WATCH" -> "VIDEO")
            String sourceType = extractSourceType(request.getType());
            
            // Find applicable trigger configurations
            List<EngagementTriggerConfig> configs = triggerConfigRepository
                    .findBySourceTypeAndSourceIdentifierAndIsActiveTrue(
                            sourceType,
                            request.getSourceId()
                    );

            if (configs.isEmpty()) {
                log.debug("No active engagement triggers found for sourceType={}, sourceId={}", 
                        sourceType, request.getSourceId());
                return;
            }

            log.info("Found {} engagement trigger(s) for sourceType={}, sourceId={}", 
                    configs.size(), sourceType, request.getSourceId());

            // Process each trigger configuration
            for (EngagementTriggerConfig config : configs) {
                processEngagementTrigger(request, config, sourceType);
            }

        } catch (Exception e) {
            log.error("Error checking engagement triggers for user {}: {}", 
                    request.getUserId(), e.getMessage(), e);
            // Don't throw - let the original tracking log succeed
        }
    }

    /**
     * Process a single engagement trigger
     * Simplified: Uses current request's session_duration directly
     */
    private void processEngagementTrigger(TrackingRequest request, EngagementTriggerConfig config, String sourceType) {
        try {
            // Get session duration from current request metadata
            Integer currentDuration = extractSessionDuration(request);
            
            if (currentDuration == null || currentDuration == 0) {
                log.debug("No session_duration found in current request metadata");
                return;
            }

            log.debug("User {} current session: {}s (threshold: {}s)", 
                    request.getChannelId(), currentDuration, config.getThresholdSeconds());

            // Check if current session meets threshold
            if (currentDuration < config.getThresholdSeconds()) {
                log.debug("Threshold not met in current session for user {}: {}/{}", 
                        request.getChannelId(), currentDuration, config.getThresholdSeconds());
                return;
            }

            // Check if already triggered
            if (wasAlreadyTriggered(request.getUserId(), config.getId(), request.getSourceId())) {
                log.debug("Engagement trigger already executed for user {} on config {}", 
                        request.getUserId(), config.getId());
                return;
            }

            log.info("Engagement threshold met! Triggering message for user {} ({}s >= {}s)", 
                    request.getChannelId(), currentDuration, config.getThresholdSeconds());

            // Send WhatsApp message
            sendEngagementMessage(request, config);

            // Log trigger execution
            logTriggerExecution(request, config, currentDuration);

        } catch (Exception e) {
            log.error("Error processing engagement trigger for user {}: {}", 
                    request.getUserId(), e.getMessage(), e);
        }
    }

    /**
     * Extract session_duration from request metadata
     */
    private Integer extractSessionDuration(TrackingRequest request) {
        try {
            if (request.getMetadata() == null) {
                return 0;
            }
            
            Object durationObj = request.getMetadata().get("session_duration");
            if (durationObj == null) {
                return 0;
            }
            
            if (durationObj instanceof Integer) {
                return (Integer) durationObj;
            } else if (durationObj instanceof Number) {
                return ((Number) durationObj).intValue();
            } else if (durationObj instanceof String) {
                return Integer.parseInt((String) durationObj);
            }
            
            return 0;
        } catch (Exception e) {
            log.warn("Failed to extract session_duration from metadata: {}", e.getMessage());
            return 0;
        }
    }

    /**
     * Check if trigger was already executed
     */
    private boolean wasAlreadyTriggered(String userId, String configId, String sourceId) {
        if (userId == null) {
            return false;
        }
        try {
            return notificationLogRepository.existsByNotificationTypeAndUserIdAndSourceAndSourceId(
                    "ENGAGEMENT_TRIGGER",
                    userId,
                    configId,
                    sourceId
            );
        } catch (Exception e) {
            log.error("Error checking trigger execution status: {}", e.getMessage(), e);
            return false; // Assume not triggered to avoid blocking
        }
    }

    /**
     * Send engagement-triggered WhatsApp message
     */
    private void sendEngagementMessage(TrackingRequest request, EngagementTriggerConfig config) {
        try {
            // Get user details from admin core service
            Map<String, Object> userDetails = webhookService.getUserDetailsByPhoneNumber(request.getChannelId());
            Object userObj = userDetails.get("user");
            
            if (userObj == null) {
                log.warn("User object missing in details for phone {}", request.getChannelId());
                return;
            }

            UserDTO user = objectMapper.convertValue(userObj, UserDTO.class);

            // Parse template variables configuration
            Map<String, List<String>> varConfig = parseJsonMap(config.getTemplateVariables());
            List<String> requiredVars = varConfig.getOrDefault(config.getTemplateName(), Collections.emptyList());

            // Resolve variables from user data
            List<String> paramValues = resolveVariables(requiredVars, userDetails, request.getChannelId());

            log.info("Sending engagement message: template={}, user={}, params={}", 
                    config.getTemplateName(), request.getChannelId(), paramValues);

            // Send message via messaging service
            sendTemplateMessage(
                    config.getInstituteId(),
                    request.getChannelId(),
                    config.getTemplateName(),
                    paramValues,
                    user.getId()
            );

        } catch (Exception e) {
            log.error("Failed to send engagement message to {}: {}", 
                    request.getChannelId(), e.getMessage(), e);
        }
    }

    /**
     * Log trigger execution to notification_log
     */
    private void logTriggerExecution(TrackingRequest request, EngagementTriggerConfig config, int totalSeconds) {
        try {
            NotificationLog triggerLog = new NotificationLog();
            triggerLog.setNotificationType("ENGAGEMENT_TRIGGER");
            triggerLog.setChannelId(request.getChannelId());
            triggerLog.setUserId(request.getUserId());
            triggerLog.setSourceId(request.getSourceId());
            triggerLog.setSource(config.getId());  // Store config ID in source field
            triggerLog.setBody(createTriggerLogBody(config, totalSeconds));
            triggerLog.setNotificationDate(LocalDateTime.now());

            notificationLogRepository.save(triggerLog);
            
            log.info("Logged engagement trigger execution for user {} on {}", 
                    request.getUserId(), request.getSourceId());

        } catch (Exception e) {
            log.error("Failed to log trigger execution: {}", e.getMessage(), e);
        }
    }

    /**
     * Create JSON body for trigger log
     */
    private String createTriggerLogBody(EngagementTriggerConfig config, int totalSeconds) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("template_sent", config.getTemplateName());
            body.put("threshold_met", config.getThresholdSeconds());
            body.put("total_seconds", totalSeconds);
            body.put("channel_type", config.getChannelType());
            return objectMapper.writeValueAsString(body);
        } catch (Exception e) {
            return String.format("{\"template_sent\":\"%s\",\"threshold_met\":%d,\"total_seconds\":%d}",
                    config.getTemplateName(), config.getThresholdSeconds(), totalSeconds);
        }
    }

    /**
     * Send WhatsApp template message
     */
    private void sendTemplateMessage(String instituteId, String toPhone, String templateName, 
                                     List<String> params, String userId) {
        try {
            WhatsAppTemplateRequest request = new WhatsAppTemplateRequest();
            request.setInstituteId(instituteId);

            WhatsAppTemplateRequest.MessageInfo msg = new WhatsAppTemplateRequest.MessageInfo();
            msg.setUserId(userId);

            Map<String, Object> payload = new HashMap<>();
            payload.put("messaging_product", "whatsapp");
            payload.put("to", toPhone);
            payload.put("type", "template");

            Map<String, Object> template = new HashMap<>();
            template.put("name", templateName);
            template.put("language", Map.of("code", "en"));

            if (!params.isEmpty()) {
                List<Map<String, Object>> components = new ArrayList<>();
                Map<String, Object> bodyComponent = new HashMap<>();
                bodyComponent.put(CombotWebhookKeys.TYPE, CombotWebhookKeys.BODY);

                List<Map<String, String>> parameters = new ArrayList<>();
                for (String paramVal : params) {
                    parameters.add(Map.of(
                            CombotWebhookKeys.TYPE, WhatsAppMessageType.TEXT.getType(), 
                            CombotWebhookKeys.TEXT, paramVal
                    ));
                }
                bodyComponent.put(CombotWebhookKeys.PARAMETERS, parameters);
                components.add(bodyComponent);
                template.put("components", components);
            }

            payload.put("template", template);
            msg.setPayload(payload);
            request.setMessages(List.of(msg));

            messagingService.sendTemplateMessages(request);

        } catch (Exception e) {
            log.error("Failed to send template message to {}: {}", toPhone, e.getMessage(), e);
        }
    }

    /**
     * Resolve template variables from user data
     * Reuses same logic as channel flow config
     */
    private List<String> resolveVariables(List<String> keys, Map<String, Object> userData, String fallbackPhone) {
        List<String> values = new ArrayList<>();
        for (String key : keys) {
            // 1. Direct field match
            if (userData.containsKey(key)) {
                values.add(String.valueOf(userData.get(key)));
                continue;
            }
            
            // 2. Custom field match
            Map<String, Object> customFields = (Map<String, Object>) userData.get(CombotConstants.FIELD_CUSTOM_FIELDS);
            if (customFields != null && customFields.containsKey(key)) {
                values.add(String.valueOf(customFields.get(key)));
                continue;
            }
            
            // 3. System defaults
            switch (key.toLowerCase()) {
                case CombotConstants.FIELD_MOBILE_NUMBER:
                case CombotConstants.FIELD_PHONE:
                    values.add(fallbackPhone);
                    break;
                case CombotConstants.FIELD_INSTITUTE_NAME:
                    values.add(userData.getOrDefault(CombotConstants.FIELD_INSTITUTE_NAME, 
                            CombotConstants.DEFAULT_FALLBACK_INSTITUTE_NAME).toString());
                    break;
                default:
                    values.add(CombotConstants.DEFAULT_FALLBACK_NAME);
            }
        }
        return values;
    }

    /**
     * Parse JSON map for template variables
     */
    private Map<String, List<String>> parseJsonMap(String json) {
        if (json == null || json.isEmpty()) {
            return Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Failed to parse template variables JSON: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    /**
     * Extract source type from notification type
     * E.g., "VIDEO_WATCH" -> "VIDEO", "PDF_VIEW" -> "PDF"
     */
    private String extractSourceType(String notificationType) {
        if (notificationType == null) {
            return "UNKNOWN";
        }
        String upper = notificationType.toUpperCase();
        if (upper.contains("VIDEO")) {
            return "VIDEO";
        } else if (upper.contains("PDF")) {
            return "PDF";
        } else if (upper.contains("PAGE") || upper.contains("WEB")) {
            return "WEB_PAGE";
        }
        return upper.split("_")[0]; // Take first part
    }
}
