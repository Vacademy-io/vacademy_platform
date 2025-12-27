package vacademy.io.notification_service.features.combot.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.features.announcements.service.UserAnnouncementPreferenceService;
import vacademy.io.notification_service.features.combot.constants.CombotConstants;
import vacademy.io.notification_service.features.combot.constants.CombotWebhookKeys;
import vacademy.io.notification_service.features.combot.dto.WhatsAppTemplateRequest;
import vacademy.io.notification_service.features.combot.entity.ChannelFlowConfig;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.enums.CombotNotificationType;
import vacademy.io.notification_service.features.combot.enums.WhatsAppMessageType;
import vacademy.io.notification_service.features.combot.repository.ChannelFlowConfigRepository;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.*;

/**
 * FINAL FULLY CORRECTED SERVICE
 * Handles:
 * - Outgoing logs
 * - Incoming message logs & Interactive Flow (State Machine)
 * - Message status events
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CombotWebhookService {

    @Value("${admin.core.service.baseurl:http://admin-core-service.vacademy.svc.cluster.local:8072}")
    private String adminCoreServiceBaseUrl;

    @Value("${spring.application.name:notification_service}")
    private String clientName;

    private final InternalClientUtils internalClientUtils;
    private final NotificationLogRepository notificationLogRepository;
    private final ChannelToInstituteMappingRepository mappingRepository;
    private final ChannelFlowConfigRepository flowConfigRepository;
    private final ObjectMapper objectMapper;
    private final UserAnnouncementPreferenceService preferenceService;

    // --- FIX: CIRCULAR DEPENDENCY BREAKER ---
    // 1. Remove 'final' so Lombok doesn't put it in the constructor
    // 2. Add @Autowired to inject it after bean construction
    // 3. Keep @Lazy to ensure a proxy is used if needed
    @Autowired
    @Lazy
    private CombotMessagingService messagingService;

    // ========================================================================
    // 1️⃣ OUTGOING MESSAGE LOGGING
    // ========================================================================
    @Transactional
    public NotificationLog logOutgoingMessage(String messageId,String toPhone,String messageBody,String userId,Map<String, Object> rawPayloadSent,String channelId)
    {
        NotificationLog out = new NotificationLog();
        out.setNotificationType(CombotNotificationType.WHATSAPP_OUTGOING.getType());
        out.setChannelId(toPhone);
        out.setBody(messageBody);
        out.setSource(CombotConstants.SOURCE_COMBOT);
        out.setSourceId(messageId);
        out.setUserId(userId);
        out.setNotificationDate(LocalDateTime.now());
        out.setSenderBusinessChannelId(channelId);

        try {
            if (rawPayloadSent != null) {
                out.setMessagePayload(objectMapper.writeValueAsString(rawPayloadSent));
            }
        } catch (Exception e) {
            log.warn("Failed to serialize message payload", e);
            out.setMessagePayload(String.valueOf(rawPayloadSent));
        }

        NotificationLog saved = notificationLogRepository.save(out);
        log.info("Logged outgoing WhatsApp message to {} -> {}", toPhone, messageBody);
        return saved;
    }

    @Transactional
    public void processCombotStatusWebhook(String messageId, String phone, String status, Map<String, Object> raw) {
        log.info("Processing Com.bot simple status webhook: messageId={}, phone={}, status={}",
                messageId, phone, status);

        if (messageId == null) {
            log.error("Com.bot webhook missing messageId");
            return;
        }

        String notificationType = CombotNotificationType.fromStatus(status).getType();

        Optional<NotificationLog> originalOpt = findOutgoingByMessageId(messageId);
        if (originalOpt.isEmpty() && phone != null) {
            originalOpt = findOutgoingByPhone(phone);
        }

        NotificationLog statusLog = new NotificationLog();
        statusLog.setNotificationType(notificationType);
        statusLog.setChannelId(phone);
        statusLog.setBody("Status: " + status);
        statusLog.setSourceId(messageId);
        statusLog.setNotificationDate(LocalDateTime.now());

        originalOpt.ifPresent(original -> {
            statusLog.setSource(original.getId());
            statusLog.setUserId(original.getUserId());
            // Preserve sender channel ID for context
            statusLog.setSenderBusinessChannelId(original.getSenderBusinessChannelId());
        });

        notificationLogRepository.save(statusLog);
        log.info("Saved Com.bot status event: {} → {}", messageId, notificationType);
    }

    // ========================================================================
    // 3️⃣ PROCESS WhatsApp Cloud API STATUS WEBHOOK
    // ========================================================================
    @Transactional
    public void processMessageStatusFromWebhook(Map<String, Object> value, Map<String, Object> entry) {
        List<Map<String, Object>> statuses = (List<Map<String, Object>>) value.get("statuses");
        if (statuses == null || statuses.isEmpty()) return;

        for (Map<String, Object> status : statuses) {
            String messageId = (String) status.get("id");
            String statusValue = (String) status.get(CombotWebhookKeys.STATUS);
            String recipientId = (String) status.get(CombotWebhookKeys.RECIPIENT_ID);

            String notificationType = CombotNotificationType.fromStatus(statusValue).getType();

            Optional<NotificationLog> originalOpt = findOutgoingByMessageId(messageId);
            if (originalOpt.isEmpty()) {
                originalOpt = findOutgoingByPhone(recipientId);
            }

            NotificationLog st = new NotificationLog();
            st.setNotificationType(notificationType);
            st.setChannelId(recipientId);
            st.setBody("Status: " + statusValue);
            st.setSourceId(messageId);
            st.setNotificationDate(LocalDateTime.now());

            originalOpt.ifPresent(original -> {
                st.setSource(original.getId());
                st.setUserId(original.getUserId());
                st.setSenderBusinessChannelId(original.getSenderBusinessChannelId());
            });

            notificationLogRepository.save(st);
            log.info("Stored WhatsApp status {} for message {}", statusValue, messageId);

            if ("failed".equalsIgnoreCase(statusValue)) {
                Map<String, Object> errors = (Map<String, Object>) status.get(CombotWebhookKeys.ERRORS);
                processMessageFailedFromWebhook(messageId, recipientId, errors, entry);
            }
        }
    }

    // ========================================================================
    // 4️⃣ FAILED MESSAGE PROCESSING
    // ========================================================================
    @Transactional
    public void processMessageFailedFromWebhook(String messageId, String recipientId,
                                                Map<String, Object> errorData, Map<String, Object> entry) {
        String errorCode = extractErrorCode(errorData);
        String errorMessage = extractErrorMessage(errorData);

        Optional<NotificationLog> originalOpt = findOutgoingByMessageId(messageId);

        NotificationLog fail = new NotificationLog();
        fail.setNotificationType(CombotNotificationType.WHATSAPP_FAILED.getType());
        fail.setChannelId(recipientId);
        fail.setBody("Error: " + errorMessage + " (code=" + errorCode + ")");
        fail.setSourceId(messageId);
        fail.setNotificationDate(LocalDateTime.now());

        originalOpt.ifPresent(original -> {
            fail.setSource(original.getId());
            fail.setUserId(original.getUserId());
            fail.setSenderBusinessChannelId(original.getSenderBusinessChannelId());
        });

        notificationLogRepository.save(fail);
        log.warn("Stored FAILED event for message {} → {}", messageId, errorMessage);
    }

    // ========================================================================
    // 5️⃣ PROCESS INCOMING MESSAGES (Interactive Flow)
    // ========================================================================

    @Transactional
    public void processIncomingMessageFromWebhook(Map<String, Object> value, Map<String, Object> entry) {
        try {
            // 1. Identify Institute
            String receivingPhoneId = extractPhoneNumberId(value);
            if (receivingPhoneId == null) {
                log.warn("Received webhook without phone_number_id in metadata");
                return;
            }

            Optional<ChannelToInstituteMapping> mappingOpt = mappingRepository.findById(receivingPhoneId);
            if (mappingOpt.isEmpty()) {
                log.warn("No institute mapped for Channel ID: {}", receivingPhoneId);
                return;
            }

            ChannelToInstituteMapping mapping = mappingOpt.get();
            String instituteId = mapping.getInstituteId();
            String channelType = mapping.getChannelType();

            // 2. Process Messages
            List<Map<String, Object>> messages = (List<Map<String, Object>>) value.get(CombotWebhookKeys.MESSAGES);
            if (messages == null) return;

            for (Map<String, Object> message : messages) {
                String userPhone = (String) message.get(CombotWebhookKeys.FROM);
                String userText = extractMessageText(message);
                String messageId = (String) message.get(CombotWebhookKeys.MESSAGE_ID);

                // Log Incoming
                logIncomingMessage(messageId, userPhone, userText, receivingPhoneId);

                // --- KEYWORD CHECK FOR OPT OUT ---
                if (isOptOutKeyword(userText)) {
                    log.info("Opt-out keyword received from {}", userPhone);
                    handleOptOut(userPhone, instituteId);
                    continue; // Stop flow processing
                }

                // --- KEYWORD CHECK FOR OPT IN ---
                if (isOptInKeyword(userText)) {
                    log.info("Opt-in keyword received from {}", userPhone);
                    handleOptIn(userPhone, instituteId);
                    continue; // Stop flow processing
                }

                // 3. Find Context & Process Flow (Existing logic)
                Optional<NotificationLog> lastLogOpt = notificationLogRepository
                        .findTopByChannelIdAndSenderBusinessChannelIdAndNotificationTypeOrderByNotificationDateDesc(
                                userPhone, receivingPhoneId, CombotNotificationType.WHATSAPP_OUTGOING.getType()
                        );

                String lastTemplate = CombotConstants.DEFAULT_TEMPLATE;
                if (lastLogOpt.isPresent()) {
                    lastTemplate = extractTemplateNameFromPayload(lastLogOpt.get().getMessagePayload());
                }

                Optional<ChannelFlowConfig> flowConfigOpt = flowConfigRepository
                        .findByInstituteIdAndCurrentTemplateNameAndChannelTypeAndIsActiveTrue(
                                instituteId, lastTemplate, channelType
                        );

                if (flowConfigOpt.isPresent()) {
                    executeFlowRule(flowConfigOpt.get(), userText, userPhone, instituteId);
                }
            }
        } catch (Exception e) {
            log.error("Error processing incoming webhook", e);
        }
    }

    private boolean isOptOutKeyword(String text) {
        if (text == null) return false;
        String normalized = text.trim().toUpperCase();
        return normalized.equals("STOP") || normalized.equals("OPT OUT") || normalized.equals("UNSUBSCRIBE");
    }

    private boolean isOptInKeyword(String text) {
        if (text == null) return false;
        String normalized = text.trim().toUpperCase();
        return normalized.equals("START") || normalized.equals("OPT IN") || normalized.equals("SUBSCRIBE");
    }

    private void handleOptOut(String userPhone, String instituteId) {
        try {
            // 1. Get User ID from Phone
            Map<String, Object> userDetails = getUserDetailsByPhoneNumber(userPhone);
            Object userObj = userDetails.get("user");
            if (userObj == null) {
                log.warn("User object missing in details for phone {}", userPhone);
                return;
            }

            // Assuming you have imported UserDTO
            UserDTO user = objectMapper.convertValue(userObj, UserDTO.class);
            String userId = user.getId();

            if (userId != null) {
                // 2. Set Unsubscribed
                preferenceService.setWhatsAppSubscriptionStatus(userId, instituteId, true,userPhone);

                // 3. Send Confirmation (Optional - basic text message)
                // Note: Standard API allows sending simple text even outside 24h window if user initiated
                // For now, we reuse the template mechanism or just log it.
                // Ideally, send a "You have successfully unsubscribed" message.
                log.info("Successfully unsubscribed user {} from institute {}", userPhone, instituteId);
            } else {
                log.warn("Could not resolve user ID for phone {} during opt-out", userPhone);
            }
        } catch (Exception e) {
            log.error("Error handling opt-out for {}", userPhone, e);
        }
    }

    private void handleOptIn(String userPhone, String instituteId) {
        try {
            Map<String, Object> userDetails = getUserDetailsByPhoneNumber(userPhone);
            Object userObj = userDetails.get("user");
            if (userObj == null) {
                log.warn("User object missing in details for phone {}", userPhone);
                return;
            }

            // Assuming you have imported UserDTO
            UserDTO user = objectMapper.convertValue(userObj, UserDTO.class);
            String userId = user.getId();
            if (userId != null) {
                preferenceService.setWhatsAppSubscriptionStatus(userId, instituteId, false,userPhone);
                log.info("Successfully resubscribed user {} for institute {}", userPhone, instituteId);
            }
        } catch (Exception e) {
            log.error("Error handling opt-in for {}", userPhone, e);
        }
    }




//    @Transactional
//    public void processIncomingMessageFromWebhook(Map<String, Object> value, Map<String, Object> entry) {
//        try {
//            // 1. Identify Institute from Webhook Metadata
//            String receivingPhoneId = extractPhoneNumberId(value);
//            if (receivingPhoneId == null) {
//                log.warn("Received webhook without phone_number_id in metadata");
//                return;
//            }
//
//            Optional<ChannelToInstituteMapping> mappingOpt = mappingRepository.findById(receivingPhoneId);
//            if (mappingOpt.isEmpty()) {
//                log.warn("No institute mapped for Channel ID: {}", receivingPhoneId);
//                return;
//            }
//
//            ChannelToInstituteMapping mapping = mappingOpt.get();
//            String instituteId = mapping.getInstituteId();
//            String channelType = mapping.getChannelType(); // e.g., "WHATSAPP_COMBOT"
//
//            // 2. Process User Messages
//            List<Map<String, Object>> messages = (List<Map<String, Object>>) value.get(CombotWebhookKeys.MESSAGES);
//            if (messages == null) return;
//
//            for (Map<String, Object> message : messages) {
//                String userPhone = (String) message.get(CombotWebhookKeys.FROM);
//                String userText = extractMessageText(message);
//                String messageId = (String) message.get(CombotWebhookKeys.MESSAGE_ID);
//
//                // Log Incoming
//                logIncomingMessage(messageId, userPhone, userText, receivingPhoneId);
//
//                // 3. Find Context (Last Template Sent)
//                Optional<NotificationLog> lastLogOpt = notificationLogRepository
//                        .findTopByChannelIdAndSenderBusinessChannelIdAndNotificationTypeOrderByNotificationDateDesc(
//                                userPhone, receivingPhoneId, CombotNotificationType.WHATSAPP_OUTGOING.getType()
//                        );
//
//                String lastTemplate = CombotConstants.DEFAULT_TEMPLATE;
//                if (lastLogOpt.isPresent()) {
//                    lastTemplate = extractTemplateNameFromPayload(lastLogOpt.get().getMessagePayload());
//                }
//
//                log.info("Processing Reply: User={} Text='{}' Context='{}'", userPhone, userText, lastTemplate);
//
//                // 4. Check Flow Configuration
//                Optional<ChannelFlowConfig> flowConfigOpt = flowConfigRepository
//                        .findByInstituteIdAndCurrentTemplateNameAndChannelTypeAndIsActiveTrue(
//                                instituteId, lastTemplate, channelType
//                        );
//
//                if (flowConfigOpt.isPresent()) {
//                    executeFlowRule(flowConfigOpt.get(), userText, userPhone, instituteId);
//                }
//            }
//        } catch (Exception e) {
//            log.error("Error processing incoming webhook", e);
//        }
//    }

    // ========================================================================
    // 6️⃣ FLOW LOGIC EXECUTION
    // ========================================================================
    private void executeFlowRule(ChannelFlowConfig config, String userText, String userPhone, String instituteId) {
        try {
            // A. Determine Next Template based on Keyword
            List<String> nextTemplates = determineNextTemplates(config.getResponseTemplateConfig(), userText);

            if (nextTemplates.isEmpty()) return;

            // B. Fetch Dynamic Data from Admin Core
            Map<String, Object> userDetails = getUserDetailsByPhoneNumber(userPhone);
            Object userObj = userDetails.get("user");
            if (userObj == null) {
                log.warn("User object missing in details for phone {}", userPhone);
                return;
            }

            // Assuming you have imported UserDTO
            UserDTO user = objectMapper.convertValue(userObj, UserDTO.class);

            // C. Send Each Template in Sequence
            Map<String, List<String>> varConfigMap = parseJsonMap(config.getVariableConfig());

            for (String templateName : nextTemplates) {
                // Get required variables for this template
                List<String> requiredVars = varConfigMap.getOrDefault(templateName, Collections.emptyList());

                // Map Data to Variables
                List<String> paramValues = resolveVariables(requiredVars, userDetails, userPhone);

                log.info("Triggering Auto-Reply: Template={} Params={}", templateName, paramValues);

                // Send Message
                sendAutoReply(instituteId, userPhone, templateName, paramValues,user.getId());

                Thread.sleep(CombotConstants.DELAY_BETWEEN_AUTO_REPLIES);
            }

        } catch (Exception e) {
            log.error("Error executing flow rule for user {}", userPhone, e);
        }
    }

    // ========================================================================
    // 7️⃣ HELPER FUNCTIONS & API CALLS
    // ========================================================================

    /**
     * Call Admin Core to get User Details
     */
    public Map<String, Object> getUserDetailsByPhoneNumber(String phoneNumber) {
        String normalizedPhone = phoneNumber.replaceAll("[^0-9]", "");
        try {
            // Using internal client utils for HMAC call
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    adminCoreServiceBaseUrl,
                    "/admin-core-service/internal/user/by-phone?phoneNumber=" + normalizedPhone,
                    null
            );

            if (response.getBody() == null) return new HashMap<>();
            return objectMapper.readValue(response.getBody(), new TypeReference<Map<String, Object>>() {});

        } catch (Exception e) {
            log.error("Error fetching user details for phone {}", normalizedPhone, e);
            return new HashMap<>();
        }
    }

    /**
     * Send Auto Reply via Messaging Service
     */
    private void sendAutoReply(String instituteId, String toPhone, String templateName, List<String> params,String userId) {
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
                    parameters.add(Map.of(CombotWebhookKeys.TYPE, WhatsAppMessageType.TEXT.getType(), CombotWebhookKeys.TEXT, paramVal));
                }
                bodyComponent.put(CombotWebhookKeys.PARAMETERS, parameters);
                components.add(bodyComponent);
                template.put("components", components);
            }

            payload.put("template", template);
            msg.setPayload(payload);
            request.setMessages(List.of(msg));

            // Calls messaging service
            messagingService.sendTemplateMessages(request);

        } catch (Exception e) {
            log.error("Failed to send auto-reply to {}", toPhone, e);
        }
    }

    // --- Data Resolvers ---

    private List<String> resolveVariables(List<String> keys, Map<String, Object> userData, String fallbackPhone) {
        List<String> values = new ArrayList<>();
        for (String key : keys) {
            // 1. Direct Field Match
            if (userData.containsKey(key)) {
                values.add(String.valueOf(userData.get(key)));
                continue;
            }
            // 2. Custom Field Match
            Map<String, Object> customFields = (Map<String, Object>) userData.get(CombotConstants.FIELD_CUSTOM_FIELDS);
            if (customFields != null && customFields.containsKey(key)) {
                values.add(String.valueOf(customFields.get(key)));
                continue;
            }
            // 3. System Defaults
            switch (key.toLowerCase()) {
                case CombotConstants.FIELD_MOBILE_NUMBER:
                case CombotConstants.FIELD_PHONE:
                    values.add(fallbackPhone);
                    break;
                case CombotConstants.FIELD_INSTITUTE_NAME:
                    values.add(userData.getOrDefault(CombotConstants.FIELD_INSTITUTE_NAME, CombotConstants.DEFAULT_FALLBACK_INSTITUTE_NAME).toString());
                    break;
                default:
                    values.add(CombotConstants.DEFAULT_FALLBACK_NAME); // Fallback
            }
        }
        return values;
    }

    private List<String> determineNextTemplates(String jsonConfig, String userText) {
        try {
            Map<String, List<String>> rules = objectMapper.readValue(jsonConfig, new TypeReference<>() {});
            String input = userText.trim().toLowerCase();

            for (Map.Entry<String, List<String>> entry : rules.entrySet()) {
                String keyword = entry.getKey().toLowerCase();
                if (!keyword.equals("default") && input.contains(keyword)) {
                    return entry.getValue();
                }
            }
            return rules.getOrDefault("default", Collections.emptyList());
        } catch (Exception e) {
            log.error("Failed to parse flow config", e);
            return Collections.emptyList();
        }
    }

    // --- Log & Extraction Helpers ---

    private void logIncomingMessage(String messageId, String fromPhone, String text, String receivingChannelId) {
        try {
            NotificationLog logEntry = new NotificationLog();
            logEntry.setNotificationType(CombotNotificationType.WHATSAPP_INCOMING.getType());
            logEntry.setChannelId(fromPhone);
            logEntry.setSource(CombotConstants.SOURCE_COMBOT);
            logEntry.setSourceId(messageId);
            logEntry.setBody(text);
            logEntry.setSenderBusinessChannelId(receivingChannelId);
            logEntry.setNotificationDate(LocalDateTime.now());
            notificationLogRepository.save(logEntry);
        } catch (Exception e) {
            log.error("Failed to log incoming message from {}", fromPhone, e);
        }
    }

    private String extractPhoneNumberId(Map<String, Object> value) {
        try {
            return (String) ((Map<?, ?>) value.get(CombotWebhookKeys.METADATA)).get(CombotWebhookKeys.PHONE_NUMBER_ID);
        } catch (Exception e) {
            return null;
        }
    }

    private String extractTemplateNameFromPayload(String payloadJson) {
        if (payloadJson == null) return CombotConstants.DEFAULT_TEMPLATE;
        try {
            Map<String, Object> payload = objectMapper.readValue(payloadJson, new TypeReference<>() {});
            Map<String, Object> template = (Map<String, Object>) payload.get(CombotWebhookKeys.TEMPLATE);
            return (String) template.get(CombotWebhookKeys.NAME);
        } catch (Exception e) {
            return CombotConstants.UNKNOWN_TEMPLATE;
        }
    }

    private String extractMessageText(Map<String, Object> message) {
        try {
            String type = (String) message.get(CombotWebhookKeys.TYPE);
            if (WhatsAppMessageType.TEXT.getType().equals(type)) return (String) ((Map) message.get(WhatsAppMessageType.TEXT.getType())).get(CombotWebhookKeys.BODY);
            if (WhatsAppMessageType.BUTTON.getType().equals(type)) return (String) ((Map) message.get(WhatsAppMessageType.BUTTON.getType())).get(WhatsAppMessageType.TEXT.getType());
            if (WhatsAppMessageType.INTERACTIVE.getType().equals(type)) {
                Map<String, Object> interactive = (Map<String, Object>) message.get(WhatsAppMessageType.INTERACTIVE.getType());
                if (interactive.containsKey("list_reply")) return (String) ((Map) interactive.get("list_reply")).get("title");
                if (interactive.containsKey("button_reply")) return (String) ((Map) interactive.get("button_reply")).get("title");
            }
            return "";
        } catch (Exception e) {
            return "";
        }
    }

    private Map<String, List<String>> parseJsonMap(String json) {
        if (json == null || json.isEmpty()) return Collections.emptyMap();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    // --- Legacy Helpers ---

    private Optional<NotificationLog> findOutgoingByMessageId(String messageId) {
        try {
            return notificationLogRepository.findTopByNotificationTypeAndSourceIdOrderByNotificationDateDesc(CombotNotificationType.WHATSAPP_OUTGOING.getType(), messageId);
        } catch (Exception e) { return Optional.empty(); }
    }

    private Optional<NotificationLog> findOutgoingByPhone(String phone) {
        try {
            return notificationLogRepository.findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(phone, CombotNotificationType.WHATSAPP_OUTGOING.getType());
        } catch (Exception e) { return Optional.empty(); }
    }

    private String extractErrorCode(Map<String, Object> errorData) {
        if (errorData == null) return CombotConstants.ERROR_CODE_UNKNOWN;
        Object code = errorData.get(CombotWebhookKeys.CODE);
        return code != null ? code.toString() : CombotConstants.ERROR_CODE_UNKNOWN;
    }

    private String extractErrorMessage(Map<String, Object> errorData) {
        if (errorData == null) return "Unknown error";
        Object msg = errorData.get("message");
        return msg != null ? msg.toString() : "Unknown error";
    }
}