package vacademy.io.notification_service.features.webhook.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;
import vacademy.io.notification_service.features.combot.action.service.FlowActionRouter;
import vacademy.io.notification_service.features.combot.entity.ChannelFlowConfig;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelFlowConfigRepository;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.features.webhook.dto.UnifiedWebhookEvent;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

/**
 * Central service that processes UnifiedWebhookEvent.
 * Logs all webhook events to notification_log table and
 * delegates to appropriate handlers based on event type.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebhookEventProcessor {

    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;
    private final FlowActionRouter flowActionRouter;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final ChannelFlowConfigRepository flowConfigRepository;

    // Notification types for webhook events
    private static final String WHATSAPP_STATUS_EVENT = "WHATSAPP_STATUS_EVENT";
    private static final String WHATSAPP_INCOMING_MESSAGE = "WHATSAPP_INCOMING_MESSAGE";
    private static final String WHATSAPP_VERIFICATION = "WHATSAPP_VERIFICATION";

    /**
     * Process a unified webhook event from any vendor.
     * 1. Logs the event to notification_log table (with businessChannelId)
     * 2. Routes to appropriate handler based on event type
     *
     * @param event Unified webhook event
     */
    public void processEvent(UnifiedWebhookEvent event) {
        log.info("Processing webhook event: vendor={}, type={}, messageId={}, phone={}, businessChannelId={}",
                event.getVendor(),
                event.getEventType(),
                event.getExternalMessageId(),
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId());

        // Step 1: Log to notification_log table
        NotificationLog savedLog = saveWebhookToNotificationLog(event);
        log.debug("Saved webhook event to notification_log: id={}", savedLog.getId());

        // Step 2: Process based on event type
        switch (event.getEventType()) {
            case SENT -> handleMessageSent(event, savedLog);
            case DELIVERED -> handleMessageDelivered(event, savedLog);
            case READ -> handleMessageRead(event, savedLog);
            case FAILED -> handleMessageFailed(event, savedLog);
            case REPLY -> handleUserReply(event, savedLog);
            case VERIFICATION_RESPONSE -> handleVerificationResponse(event, savedLog);
            case UNKNOWN -> handleUnknownEvent(event, savedLog);
        }
    }

    /**
     * Save webhook event to notification_log table
     */
    private NotificationLog saveWebhookToNotificationLog(UnifiedWebhookEvent event) {
        NotificationLog notificationLog = new NotificationLog();

        // Determine notification type based on event
        String notificationType = determineNotificationType(event);
        notificationLog.setNotificationType(notificationType);

        // Channel ID is the phone number for WhatsApp
        notificationLog.setChannelId(event.getPhoneNumber());

        // Body contains event details
        notificationLog.setBody(buildEventBody(event));

        // Source is the vendor name (WATI, META, etc.)
        notificationLog.setSource(event.getVendor());

        // Source ID is the external message ID
        notificationLog.setSourceId(event.getExternalMessageId());

        // Business channel ID - identifies which business account
        notificationLog.setSenderBusinessChannelId(event.getBusinessChannelId());

        // Notification date from event timestamp
        if (event.getTimestamp() != null) {
            notificationLog.setNotificationDate(
                    LocalDateTime.ofInstant(event.getTimestamp(), ZoneId.systemDefault()));
        } else {
            notificationLog.setNotificationDate(LocalDateTime.now());
        }

        // Store raw payload as JSON
        try {
            if (event.getRawPayload() != null) {
                notificationLog.setMessagePayload(objectMapper.writeValueAsString(event.getRawPayload()));
            }
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize raw payload: {}", e.getMessage());
            notificationLog.setMessagePayload("{}");
        }

        return notificationLogRepository.save(notificationLog);
    }

    /**
     * Determine notification type based on event type
     */
    private String determineNotificationType(UnifiedWebhookEvent event) {
        return switch (event.getEventType()) {
            case SENT, DELIVERED, READ, FAILED -> WHATSAPP_STATUS_EVENT;
            case REPLY -> WHATSAPP_INCOMING_MESSAGE;
            case VERIFICATION_RESPONSE -> WHATSAPP_VERIFICATION;
            case UNKNOWN -> "WEBHOOK_UNKNOWN";
        };
    }

    /**
     * Build human-readable body from event
     */
    private String buildEventBody(UnifiedWebhookEvent event) {
        StringBuilder body = new StringBuilder();

        if (event.getMessageText() != null) {
            body.append(truncateText(event.getMessageText(), 100));
        }

        if (event.getErrorMessage() != null) {
            body.append(" [ERROR: ").append(event.getErrorMessage()).append("]");
        }

        return body.toString();
    }

    private void handleMessageSent(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.info("Message sent - externalId={}, phone={}, businessChannel={}, logId={}",
                event.getExternalMessageId(),
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                logEntry.getId());
    }

    private void handleMessageDelivered(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.info("Message delivered - externalId={}, phone={}, businessChannel={}, logId={}",
                event.getExternalMessageId(),
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                logEntry.getId());
    }

    private void handleMessageRead(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.info("Message read - externalId={}, phone={}, businessChannel={}, logId={}",
                event.getExternalMessageId(),
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                logEntry.getId());
    }

    private void handleMessageFailed(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.error("Message failed - externalId={}, phone={}, businessChannel={}, error={} ({}), logId={}",
                event.getExternalMessageId(),
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                event.getErrorMessage(),
                event.getErrorCode(),
                logEntry.getId());
    }

    /**
     * Handle user reply - routes through action_template_config if configured
     */
    private void handleUserReply(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.info("User reply received - phone={}, businessChannel={}, text={}, logId={}",
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                truncateText(event.getMessageText(), 50),
                logEntry.getId());

        // Route through FlowActionRouter for WATI webhooks
        routeIncomingMessage(event);
    }

    private void handleVerificationResponse(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.info("Verification response received - phone={}, businessChannel={}, text={}, logId={}",
                maskPhoneNumber(event.getPhoneNumber()),
                event.getBusinessChannelId(),
                event.getMessageText(),
                logEntry.getId());

        // Also route verification responses through action router
        routeIncomingMessage(event);
    }

    /**
     * Route incoming message through FlowActionRouter based on
     * action_template_config
     */

    // Ensure you have ObjectMapper injected in this class
// @Autowired
// private ObjectMapper objectMapper;

    private void routeIncomingMessage(UnifiedWebhookEvent event) {
        String businessChannelId = event.getBusinessChannelId();

        if (businessChannelId == null || businessChannelId.isBlank()) {
            log.debug("No businessChannelId available, skipping action routing");
            return;
        }

        try {
            // 1. Get institute from channel mapping
            Optional<ChannelToInstituteMapping> mappingOpt = channelMappingRepository.findById(businessChannelId);
            if (mappingOpt.isEmpty()) {
                log.debug("No channel mapping found for businessChannelId={}", businessChannelId);
                return;
            }

            ChannelToInstituteMapping mapping = mappingOpt.get();
            String instituteId = mapping.getInstituteId();
            String channelType = mapping.getChannelType();

            // 2. Get flow config for this channel
            Optional<ChannelFlowConfig> configOpt = flowConfigRepository
                    .findByInstituteIdAndChannelTypeAndIsActiveTrue(instituteId, channelType);

            if (configOpt.isEmpty()) {
                log.debug("No active flow config for instituteId={}, channelType={}", instituteId, channelType);
                return;
            }

            ChannelFlowConfig config = configOpt.get();

            // 3. Check if action_template_config exists
            String actionConfigJson = config.getActionTemplateConfig();
            if (actionConfigJson == null || actionConfigJson.isBlank()) {
                log.debug("No action_template_config for instituteId={}", instituteId);
                return;
            }

            // ==================================================================================
            // NEW CODE: Parse JSON to extract session IDs before building context
            // ==================================================================================
            String packageSessionId = null;
            String destinationPackageSessionId = null;

            try {
                JsonNode rootNode = objectMapper.readTree(actionConfigJson);

                if (rootNode.has("package_session_id")) {
                    packageSessionId = rootNode.get("package_session_id").asText();
                }

                if (rootNode.has("destination_package_session_id")) {
                    destinationPackageSessionId = rootNode.get("destination_package_session_id").asText();
                }
            } catch (Exception e) {
                log.error("Failed to parse action_template_config JSON for extra fields", e);
                // We continue execution; the fields will just be null
            }
            // ==================================================================================

            // 4. Build flow context (Added the new fields here)
            FlowContext flowContext = FlowContext.builder()
                    .phoneNumber(event.getPhoneNumber())
                    .instituteId(instituteId)
                    .businessChannelId(businessChannelId)
                    .channelType(channelType)
                    .messageText(event.getMessageText())
                    .packageSessionId(packageSessionId)                        // <--- NEW
                    .destinationPackageSessionId(destinationPackageSessionId)  // <--- NEW
                    .build();

            // 5. Route actions
            boolean actionsExecuted = flowActionRouter.routeActions(
                    actionConfigJson,
                    event.getMessageText(),
                    flowContext);

            if (actionsExecuted) {
                log.info("Actions executed for phone={} from WATI webhook",
                        maskPhoneNumber(event.getPhoneNumber()));
            }

        } catch (Exception e) {
            log.error("Error routing incoming message: {}", e.getMessage(), e);
        }
    }


//    private void routeIncomingMessage(UnifiedWebhookEvent event) {
//        String businessChannelId = event.getBusinessChannelId();
//
//        if (businessChannelId == null || businessChannelId.isBlank()) {
//            log.debug("No businessChannelId available, skipping action routing");
//            return;
//        }
//
//        try {
//            // 1. Get institute from channel mapping
//            Optional<ChannelToInstituteMapping> mappingOpt = channelMappingRepository.findById(businessChannelId);
//            if (mappingOpt.isEmpty()) {
//                log.debug("No channel mapping found for businessChannelId={}", businessChannelId);
//                return;
//            }
//
//            ChannelToInstituteMapping mapping = mappingOpt.get();
//            String instituteId = mapping.getInstituteId();
//            String channelType = mapping.getChannelType();
//
//            // 2. Get flow config for this channel
//            Optional<ChannelFlowConfig> configOpt = flowConfigRepository
//                    .findByInstituteIdAndChannelTypeAndIsActiveTrue(instituteId, channelType);
//
//            if (configOpt.isEmpty()) {
//                log.debug("No active flow config for instituteId={}, channelType={}", instituteId, channelType);
//                return;
//            }
//
//            ChannelFlowConfig config = configOpt.get();
//
//            // 3. Check if action_template_config exists
//            if (config.getActionTemplateConfig() == null || config.getActionTemplateConfig().isBlank()) {
//                log.debug("No action_template_config for instituteId={}", instituteId);
//                return;
//            }
//
//            // 4. Build flow context
//            FlowContext flowContext = FlowContext.builder()
//                    .phoneNumber(event.getPhoneNumber())
//                    .instituteId(instituteId)
//                    .businessChannelId(businessChannelId)
//                    .channelType(channelType)
//                    .messageText(event.getMessageText())
//                    .build();
//
//            // 5. Route actions
//            boolean actionsExecuted = flowActionRouter.routeActions(
//                    config.getActionTemplateConfig(),
//                    event.getMessageText(),
//                    flowContext);
//
//            if (actionsExecuted) {
//                log.info("Actions executed for phone={} from WATI webhook",
//                        maskPhoneNumber(event.getPhoneNumber()));
//            }
//
//        } catch (Exception e) {
//            log.error("Error routing incoming message: {}", e.getMessage(), e);
//        }
//    }

    private void handleUnknownEvent(UnifiedWebhookEvent event, NotificationLog logEntry) {
        log.warn("Unknown event type received - vendor={}, businessChannel={}, logId={}",
                event.getVendor(),
                event.getBusinessChannelId(),
                logEntry.getId());
    }

    private String maskPhoneNumber(String phone) {
        if (phone == null || phone.length() < 4) {
            return "***";
        }
        return "***" + phone.substring(phone.length() - 4);
    }

    private String truncateText(String text, int maxLength) {
        if (text == null)
            return null;
        return text.length() <= maxLength ? text : text.substring(0, maxLength) + "...";
    }
}
