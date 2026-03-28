package vacademy.io.notification_service.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.CombotMessageProvider;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.common.logging.SentryLogger;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * WhatsApp sending service — delegates to CombotMessageProvider (COMBOT/META) and
 * WatiMessageProvider (WATI) while maintaining backward-compatible API signatures.
 *
 * This class handles:
 * - Provider routing (WATI/COMBOT/META) based on institute settings
 * - Test phone number allowlist filtering
 * - Notification log persistence
 * - Result format mapping (provider exceptions → List<Map<String, Boolean>>)
 */
@Service
@Slf4j
public class WhatsAppService {

    private final ObjectMapper objectMapper;
    private final CombotMessageProvider combotMessageProvider;
    private final NotificationLogRepository notificationLogRepository;
    private final InstituteInternalService internalService;
    private final WatiService watiService; // kept for WATI bulk sends (WatiMessageProvider is single-message)

    @Autowired
    public WhatsAppService(CombotMessageProvider combotMessageProvider,
                           WatiService watiService,
                           InstituteInternalService internalService,
                           NotificationLogRepository notificationLogRepository) {
        this.combotMessageProvider = combotMessageProvider;
        this.watiService = watiService;
        this.internalService = internalService;
        this.notificationLogRepository = notificationLogRepository;
        this.objectMapper = new ObjectMapper();
        this.objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    // ==================== Public API (unchanged signatures) ====================

    /**
     * Legacy signature — delegates to sendWhatsappMessagesExtended.
     * Used by: AnnouncementDeliveryService
     */
    public List<Map<String, Boolean>> sendWhatsappMessages(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            String languageCode, String headerType, String instituteId) {
        return sendWhatsappMessagesExtended(templateName, bodyParams, headerParams,
                null, null, null, languageCode, headerType, instituteId);
    }

    /**
     * Extended signature with video headers and button URL params.
     * Used by: WhatsappController, UnifiedSendService, (via sendWhatsappMessages) AnnouncementDeliveryService
     */
    public List<Map<String, Boolean>> sendWhatsappMessagesExtended(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            Map<String, String> headerVideoParams,
            Map<String, String> buttonUrlParams,
            Map<String, String> buttonIndexParams,
            String languageCode, String headerType, String instituteId) {

        if (instituteId == null) {
            log.error("Missing instituteId for WhatsApp message sending");
            return null;
        }

        try {
            InstituteInfoDTO instituteDTO = internalService.getInstituteByInstituteId(instituteId);
            String jsonString = instituteDTO.getSetting();
            log.info("Retrieved institute settings for: {}", instituteId);

            JsonNode root = objectMapper.readTree(jsonString);
            JsonNode whatsappSetting = root.path(NotificationConstants.SETTING)
                    .path(NotificationConstants.WHATSAPP_SETTING)
                    .path(NotificationConstants.DATA)
                    .path(NotificationConstants.UTILITY_WHATSAPP);

            // Apply test allowlist filter
            bodyParams = filterRecipientsByTestAllowListIfEnabled(root, bodyParams);
            if (bodyParams == null || bodyParams.isEmpty()) {
                log.info("TEST allowlist active and no recipients matched; skipping sends");
                return List.of();
            }

            // Route to provider
            String provider = whatsappSetting.path(NotificationConstants.PROVIDER).asText("META").toUpperCase();
            log.info("WhatsApp provider for institute {}: {}, recipients={}", instituteId, provider, bodyParams.size());

            List<Map<String, Boolean>> results;
            String senderChannelId = null;

            if ("WATI".equals(provider)) {
                senderChannelId = resolveWatiChannelId(whatsappSetting);
                results = sendViaWati(templateName, bodyParams, languageCode, whatsappSetting);
            } else {
                // COMBOT and META both go through CombotMessageProvider
                senderChannelId = resolveSenderChannelId(whatsappSetting, provider);
                results = sendViaCombotProvider(templateName, bodyParams, headerParams,
                        headerVideoParams, buttonUrlParams, buttonIndexParams,
                        languageCode, headerType, instituteId);
            }

            // Log to notification_log
            logWhatsAppMessages(templateName, bodyParams, headerParams, languageCode,
                    headerType, provider, results, senderChannelId);

            return results;

        } catch (Exception e) {
            log.error("Exception occurred while sending WhatsApp messages for institute {}: {}",
                    instituteId, e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp messages")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("institute.id", instituteId)
                    .withTag("template.name", templateName != null ? templateName : "unknown")
                    .withTag("user.count", String.valueOf(bodyParams != null ? bodyParams.size() : 0))
                    .withTag("operation", "sendWhatsappMessages")
                    .send();
            return null;
        }
    }

    // ==================== Provider Delegates ====================

    /**
     * Delegates to CombotMessageProvider for both COMBOT and META providers.
     * Converts the legacy format (List<Map<phone, Map<key,value>>>) to the
     * provider's templatePayload format, one message at a time.
     */
    private List<Map<String, Boolean>> sendViaCombotProvider(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            Map<String, String> headerVideoParams,
            Map<String, String> buttonUrlParams,
            Map<String, String> buttonIndexParams,
            String languageCode, String headerType, String instituteId) {

        List<Map<String, Boolean>> results = new ArrayList<>();

        for (Map<String, Map<String, String>> userDetail : bodyParams) {
            String phoneNumber = userDetail.keySet().iterator().next();
            Map<String, String> params = userDetail.get(phoneNumber);

            try {
                // Build templatePayload in the format CombotMessageProvider expects
                Map<String, Object> templatePayload = new HashMap<>();
                templatePayload.put("templateName", templateName);
                templatePayload.put("languageCode", languageCode != null ? languageCode : "en");

                // Body params: sorted by numeric key → List<String>
                if (params != null && !params.isEmpty()) {
                    List<String> bodyParamList = params.entrySet().stream()
                            .sorted(Comparator.comparingInt(e -> {
                                try { return Integer.parseInt(e.getKey()); }
                                catch (NumberFormatException ex) { return 999; }
                            }))
                            .map(Map.Entry::getValue)
                            .collect(Collectors.toList());
                    templatePayload.put("bodyParams", bodyParamList);
                }

                // Header config
                Map<String, Object> headerConfig = buildHeaderConfig(phoneNumber,
                        headerParams, headerVideoParams, headerType);
                if (headerConfig != null) {
                    templatePayload.put("headerConfig", headerConfig);
                }

                // Button config
                List<Map<String, Object>> buttonConfig = buildButtonConfig(phoneNumber,
                        buttonUrlParams, buttonIndexParams);
                if (buttonConfig != null) {
                    templatePayload.put("buttonConfig", buttonConfig);
                }

                // Delegate to CombotMessageProvider
                combotMessageProvider.sendTemplate(phoneNumber, templatePayload, instituteId, null);
                results.add(Map.of(phoneNumber, true));

                // Rate limit
                Thread.sleep(100);

            } catch (Exception e) {
                log.error("Failed to send to {} via provider: {}", phoneNumber, e.getMessage());
                results.add(Map.of(phoneNumber, false));
            }
        }

        return results;
    }

    /**
     * WATI uses bulk API via WatiService (WatiMessageProvider is single-message only).
     */
    private List<Map<String, Boolean>> sendViaWati(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            String languageCode, JsonNode whatsappSetting) {
        try {
            JsonNode watiConfig = whatsappSetting.path(NotificationConstants.WATI);
            String apiKey = watiConfig.path(NotificationConstants.API_KEY).asText();
            String apiUrl = watiConfig.path(NotificationConstants.API_URL).asText("https://live-server.wati.io");

            if (apiKey == null || apiKey.isBlank()) {
                log.error("WATI API key not configured");
                return bodyParams.stream()
                        .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                        .collect(Collectors.toList());
            }

            log.info("Sending WhatsApp messages via WATI: template={}, recipients={}",
                    templateName, bodyParams.size());

            return watiService.sendTemplateMessages(
                    templateName, bodyParams,
                    languageCode != null ? languageCode : "en",
                    apiKey, apiUrl,
                    "Notification - " + templateName);

        } catch (Exception e) {
            log.error("Error sending via WATI: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp via WATI")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("whatsapp.provider", "WATI")
                    .withTag("template.name", templateName)
                    .withTag("user.count", String.valueOf(bodyParams != null ? bodyParams.size() : 0))
                    .withTag("operation", "sendViaWati")
                    .send();
            return bodyParams.stream()
                    .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                    .collect(Collectors.toList());
        }
    }

    // ==================== Helpers ====================

    private Map<String, Object> buildHeaderConfig(String phoneNumber,
            Map<String, Map<String, String>> headerParams,
            Map<String, String> headerVideoParams,
            String headerType) {

        // Video header takes precedence
        if (headerVideoParams != null && headerVideoParams.containsKey(phoneNumber)) {
            return Map.of(
                    "type", "video",
                    "url", headerVideoParams.get(phoneNumber));
        }

        // Image/document header
        if (headerParams != null && headerParams.containsKey(phoneNumber)) {
            Map<String, String> hp = headerParams.get(phoneNumber);
            if (hp == null || hp.isEmpty()) return null;
            String url = hp.getOrDefault("link", hp.values().iterator().next());
            String type = "image".equalsIgnoreCase(headerType) ? "image" : "document";
            Map<String, Object> config = new HashMap<>();
            config.put("type", type);
            config.put("url", url);
            if ("document".equals(type)) {
                config.put("filename", "file.pdf");
            }
            return config;
        }

        return null;
    }

    private List<Map<String, Object>> buildButtonConfig(String phoneNumber,
            Map<String, String> buttonUrlParams,
            Map<String, String> buttonIndexParams) {

        if (buttonUrlParams == null || !buttonUrlParams.containsKey(phoneNumber)) {
            return null;
        }

        String urlSuffix = buttonUrlParams.get(phoneNumber);
        String index = buttonIndexParams != null
                ? buttonIndexParams.getOrDefault(phoneNumber, "0") : "0";

        int idx;
        try { idx = Integer.parseInt(index); }
        catch (NumberFormatException e) { idx = 0; }

        Map<String, Object> btn = new HashMap<>();
        btn.put("type", "url");
        btn.put("index", idx);
        btn.put("urlSuffix", urlSuffix);

        return List.of(btn);
    }

    private String resolveWatiChannelId(JsonNode whatsappSetting) {
        try {
            JsonNode wati = whatsappSetting.path(NotificationConstants.WATI);
            String number = wati.path("whatsappNumber").asText(
                    wati.path("whatsapp_number").asText(null));
            if (number != null && !number.isBlank()) return number;
            // Fallback: phone_number_id used in channel_to_institute_mapping
            return wati.path("phone_number_id").asText(
                    wati.path("phoneNumberId").asText(null));
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveSenderChannelId(JsonNode whatsappSetting, String provider) {
        try {
            if ("COMBOT".equals(provider)) {
                return whatsappSetting.path(NotificationConstants.COMBOT)
                        .path(NotificationConstants.PHONE_NUMBER_ID).asText(null);
            } else {
                // META
                JsonNode meta = whatsappSetting.path(NotificationConstants.META);
                if (!meta.isMissingNode()) {
                    return meta.path(NotificationConstants.APP_ID).asText(null);
                }
                return whatsappSetting.path(NotificationConstants.APP_ID).asText(null);
            }
        } catch (Exception e) {
            return null;
        }
    }

    // ==================== Test Allowlist Filter ====================

    private List<Map<String, Map<String, String>>> filterRecipientsByTestAllowListIfEnabled(
            JsonNode root,
            List<Map<String, Map<String, String>>> bodyParams) {

        if (root == null || bodyParams == null || bodyParams.isEmpty())
            return bodyParams;

        JsonNode testConfig = root.path(NotificationConstants.SETTING)
                .path(NotificationConstants.TEST_PHONE_NUMBER);

        if (testConfig.isMissingNode()) {
            return bodyParams;
        }

        JsonNode dataNode = testConfig.path(NotificationConstants.DATA);
        boolean flagEnabled = false;
        JsonNode mobileNumbersNode = null;

        if (dataNode != null && !dataNode.isMissingNode() && dataNode.isObject()) {
            flagEnabled = dataNode.path(NotificationConstants.FLAG).asBoolean(false);
            mobileNumbersNode = dataNode.path("mobile_numbers");
        } else {
            flagEnabled = testConfig.path(NotificationConstants.FLAG).asBoolean(false);
            mobileNumbersNode = dataNode;
        }

        if (!flagEnabled) {
            return bodyParams;
        }

        if (mobileNumbersNode == null || mobileNumbersNode.isMissingNode() || !mobileNumbersNode.isArray()
                || mobileNumbersNode.size() == 0) {
            return bodyParams;
        }

        Set<String> allow = new HashSet<>();
        for (JsonNode node : mobileNumbersNode) {
            String raw = node.asText();
            if (raw != null && !raw.isBlank()) {
                allow.add(raw.replaceAll("[^0-9]", ""));
            }
        }
        if (allow.isEmpty())
            return bodyParams;

        List<Map<String, Map<String, String>>> filtered = bodyParams.stream()
                .filter(detail -> {
                    String phone = detail.keySet().iterator().next();
                    String normalized = phone.replaceAll("[^0-9]", "");
                    return allow.contains(normalized);
                })
                .collect(Collectors.toList());

        log.info("TEST allowlist enabled: {} of {} recipients will be sent", filtered.size(), bodyParams.size());
        return filtered;
    }

    // ==================== Notification Logging ====================

    private void logWhatsAppMessages(String templateName,
                                    List<Map<String, Map<String, String>>> bodyParams,
                                    Map<String, Map<String, String>> headerParams,
                                    String languageCode,
                                    String headerType,
                                    String provider,
                                    List<Map<String, Boolean>> results,
                                    String senderBusinessChannelId) {
        try {
            List<NotificationLog> logs = new ArrayList<>();

            for (int i = 0; i < bodyParams.size() && i < results.size(); i++) {
                Map<String, Map<String, String>> userDetail = bodyParams.get(i);
                Map<String, Boolean> result = results.get(i);

                String phoneNumber = userDetail.keySet().iterator().next();
                Map<String, String> params = userDetail.get(phoneNumber);

                String userId = params.getOrDefault("userId", params.getOrDefault("user_id", null));

                Boolean sendSuccess = result.get(phoneNumber);
                if (sendSuccess == null && !result.isEmpty()) {
                    sendSuccess = result.values().iterator().next();
                }
                boolean success = Boolean.TRUE.equals(sendSuccess);

                Map<String, Object> payload = new HashMap<>();
                payload.put("templateName", templateName);
                payload.put("phoneNumber", phoneNumber);
                payload.put("bodyParams", params);
                payload.put("languageCode", languageCode);
                payload.put("headerType", headerType);
                payload.put("provider", provider);
                if (headerParams != null && headerParams.containsKey(phoneNumber)) {
                    payload.put("headerParams", headerParams.get(phoneNumber));
                }

                String payloadJson;
                try {
                    payloadJson = objectMapper.writeValueAsString(payload);
                } catch (Exception e) {
                    payloadJson = payload.toString();
                }

                String bodyMessage = String.format("WhatsApp Template: %s | Provider: %s | Status: %s | Params: %s",
                        templateName, provider, success ? "SUCCESS" : "FAILED", params);

                NotificationLog notifLog = new NotificationLog();
                notifLog.setNotificationType("WHATSAPP_MESSAGE_OUTGOING");
                notifLog.setChannelId(phoneNumber);
                notifLog.setBody(bodyMessage);
                notifLog.setSource("whatsapp-service");
                notifLog.setSourceId(templateName);
                notifLog.setUserId(userId);
                notifLog.setNotificationDate(LocalDateTime.now());
                notifLog.setMessagePayload(payloadJson);
                notifLog.setSenderBusinessChannelId(senderBusinessChannelId);

                logs.add(notifLog);
            }

            if (!logs.isEmpty()) {
                notificationLogRepository.saveAll(logs);
                log.info("Logged {} WhatsApp messages to notification_log table", logs.size());
            }

        } catch (Exception e) {
            log.error("Failed to log WhatsApp messages to notification_log: {}", e.getMessage(), e);
        }
    }
}
