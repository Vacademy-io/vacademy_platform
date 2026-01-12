package vacademy.io.notification_service.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;
import vacademy.io.notification_service.features.external_communication_log.service.ExternalCommunicationLogService;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationSource;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.common.logging.SentryLogger;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class WhatsAppService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final WatiService watiService;
    private final ExternalCommunicationLogService externalCommunicationLogService;
    private final NotificationLogRepository notificationLogRepository;

    // Global WhatsApp credentials (fallback when institute doesn't have them)
    @org.springframework.beans.factory.annotation.Value("${whatsapp.meta.app-id:}")
    private String globalAppId;

    @org.springframework.beans.factory.annotation.Value("${whatsapp.meta.access-token:}")
    private String globalAccessToken;

    String appId = null;
    String accessToken = null;

    private final InstituteInternalService internalService;

    @Autowired
    public WhatsAppService(WatiService watiService, InstituteInternalService internalService,
            ExternalCommunicationLogService externalCommunicationLogService,
            NotificationLogRepository notificationLogRepository) {
        this.internalService = internalService;
        this.watiService = watiService;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.externalCommunicationLogService = externalCommunicationLogService;
        this.notificationLogRepository = notificationLogRepository;
    }

    // Helper method to create body component
    public static Component createBodyComponent(List<Parameter> parameters) {
        return new Component("body", parameters);
    }

    public static Component createHeaderComponent(List<Parameter> parameters) {
        return new Component("header", parameters);
    }

    // Helper method to create text parameter
    public static Parameter createTextParameter(String text) {
        return new Parameter("text", text, null, null, null, null);
    }

    // Helper method to create currency parameter
    public static Parameter createCurrencyParameter(String fallbackValue, String code, long amount1000) {
        return new Parameter("currency", null, null, null,
                new Currency(fallbackValue, code, amount1000), null);
    }

    // Helper method to create document parameter
    public static Parameter createDocumentParameter(String link, String id, String filename) {
        return new Parameter("document", null, null, new Document(link, id, filename),
                null, null);
    }

    // Helper method to create image parameter
    public static Parameter createImageParameter(String link, String id, String filename) {
        return new Parameter("image", null, new Image(link, filename), null,
                null, null);
    }

    // Helper method to create date_time parameter
    public static Parameter createDateTimeParameter(String fallbackValue, String timestamp) {
        return new Parameter("date_time", null, null, null, null,
                new DateTime(fallbackValue, timestamp));
    }

    public List<Map<String, Boolean>> sendWhatsappMessages(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams, String languageCode, String headerType, String instituteId,
            Map<String, Map<String, String>> buttonParams) {

        // Initialize with empty settings (will fall back to global credentials)
        JsonNode whatsappSettings = objectMapper.createObjectNode();

        try {
            // Try to fetch institute-specific WhatsApp settings
            if (org.springframework.util.StringUtils.hasText(instituteId)) {
                try {
                    InstituteInfoDTO institute = internalService.getInstituteByInstituteId(instituteId);
                    if (institute != null && institute.getSetting() != null) {
                        JsonNode settings = objectMapper.readTree(institute.getSetting());

                        // Navigate to whatsapp_setting.data
                        JsonNode whatsappSettingData = settings
                                .path(NotificationConstants.SETTING)
                                .path("whatsapp_setting")
                                .path(NotificationConstants.DATA);

                        if (!whatsappSettingData.isMissingNode()) {
                            whatsappSettings = whatsappSettingData;
                            log.info("Found WhatsApp settings for institute: {}", instituteId);
                        } else {
                            log.info("No WhatsApp settings found for institute: {}, using global credentials",
                                    instituteId);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Error fetching WhatsApp settings for institute {}, using global credentials: {}",
                            instituteId, e.getMessage());
                }
            } else {
                log.info("No instituteId provided, using global WhatsApp credentials");
            }

            // Send via Meta with institute-specific or global credentials
            String provider = "META";
            log.info("WhatsApp provider: {}", provider);

            return sendViaMeta(templateName, bodyParams, headerParams, languageCode, headerType,
                    whatsappSettings, buttonParams);

        } catch (Exception e) {
            log.error("Exception occurred while sending WhatsApp messages for institute {}: {}", instituteId,
                    e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp messages")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("template.name", templateName)
                    .withTag("institute.id", instituteId)
                    .withTag("user.count", String.valueOf(bodyParams != null ? bodyParams.size() : 0))
                    .withTag("language.code", languageCode != null ? languageCode : "unknown")
                    .withTag("operation", "sendWhatsappMessages")
                    .send();
            return null;
        }
    }

    private List<Map<String, Map<String, String>>> filterRecipientsByTestAllowListIfEnabled(
            JsonNode root,
            List<Map<String, Map<String, String>>> bodyParams) {

        if (root == null || bodyParams == null || bodyParams.isEmpty())
            return bodyParams;

        JsonNode testConfig = root.path(NotificationConstants.SETTING)
                .path(NotificationConstants.TEST_PHONE_NUMBER);

        if (testConfig.isMissingNode()) {
            return bodyParams; // no filtering
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
            return bodyParams; // filtering disabled
        }

        if (mobileNumbersNode == null || mobileNumbersNode.isMissingNode() || !mobileNumbersNode.isArray()
                || mobileNumbersNode.size() == 0) {
            return bodyParams; // nothing to filter by
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

    /**
     * Send WhatsApp messages via WATI
     */
    private List<Map<String, Boolean>> sendViaWati(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            String languageCode,
            JsonNode whatsappSetting) {
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

            List<Map<String, Boolean>> results = watiService.sendTemplateMessages(
                    templateName,
                    bodyParams,
                    languageCode != null ? languageCode : "en",
                    apiKey,
                    apiUrl,
                    "Notification - " + templateName);

            // Log each sent message to notification_log table
            logWhatsAppMessages(templateName, bodyParams, null, languageCode, null, "WATI", results);

            return results;

        } catch (Exception e) {
            log.error("Error sending via WATI: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp via WATI")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("whatsapp.provider", "WATI")
                    .withTag("template.name", templateName)
                    .withTag("user.count", String.valueOf(bodyParams != null ? bodyParams.size() : 0))
                    .withTag("language.code", languageCode != null ? languageCode : "unknown")
                    .withTag("operation", "sendViaWati")
                    .send();
            return bodyParams.stream()
                    .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                    .collect(Collectors.toList());
        }
    }

    /**
     * Send WhatsApp messages via Meta (Facebook) - existing implementation
     */
    private List<Map<String, Boolean>> sendViaMeta(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            String languageCode,
            String headerType,
            JsonNode whatsappSetting,
            Map<String, Map<String, String>> buttonParams) {

        // Extract Meta credentials from institute settings
        JsonNode metaConfig = whatsappSetting.path(NotificationConstants.META);

        // Fallback to root level for backward compatibility
        if (metaConfig.isMissingNode()) {
            appId = whatsappSetting.path(NotificationConstants.APP_ID).asText();
            accessToken = whatsappSetting.path(NotificationConstants.ACCESS_TOKEN).asText();
        } else {
            appId = metaConfig.path(NotificationConstants.APP_ID).asText();
            accessToken = metaConfig.path(NotificationConstants.ACCESS_TOKEN).asText();
        }

        // Track whether we're using institute-specific or global credentials
        boolean usingInstituteCredentials = false;
        if (appId != null && !appId.isBlank() && accessToken != null && !accessToken.isBlank()) {
            usingInstituteCredentials = true;
            log.info("Using institute-specific WhatsApp credentials (app_id: {}...)",
                    appId.substring(0, Math.min(8, appId.length())));
        }

        // Use global credentials as fallback (like email does)
        if (appId == null || appId.isBlank()) {
            appId = globalAppId;
            log.info("Institute app_id not found, using global WhatsApp app_id from environment");
        }
        if (accessToken == null || accessToken.isBlank()) {
            accessToken = globalAccessToken;
            log.info("Institute access_token not found, using global WhatsApp access_token from environment");
        }

        // Final validation
        if (appId == null || appId.isBlank() || accessToken == null || accessToken.isBlank()) {
            log.error("Meta WhatsApp credentials not configured (neither in institute settings nor in properties)");
            return bodyParams.stream()
                    .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                    .collect(Collectors.toList());
        }

        // Log final credential source
        if (!usingInstituteCredentials) {
            log.info("Using global WhatsApp credentials from environment variables");
        }

        // Deduplicate based on phone number, retaining the first occurrence
        Map<String, Map<String, String>> uniqueUsers = bodyParams.stream()
                .collect(Collectors.toMap(
                        detail -> detail.keySet().iterator().next(), // Phone number as key
                        detail -> detail.get(detail.keySet().iterator().next()), // Params as value
                        (existing, replacement) -> existing // Keep the first entry on duplicates
                ));

        List<Map<String, Boolean>> results = uniqueUsers.entrySet().stream()
                .map(entry -> {
                    String phoneNumber = entry.getKey();
                    Map<String, String> params = entry.getValue();

                    try {
                        // Sort parameters by numeric key and create text parameters
                        List<Parameter> parameters = params.entrySet().stream()
                                .sorted(Comparator.comparingInt(e -> Integer.parseInt(e.getKey())))
                                .map(e -> createTextParameter(e.getValue()))
                                .collect(Collectors.toList());

                        Component bodyComponent = createBodyComponent(parameters);

                        List<Parameter> headerParameters = (headerParams == null
                                || headerParams.get(phoneNumber) == null)
                                        ? Collections.emptyList()
                                        : headerParams.get(phoneNumber).entrySet().stream()
                                                .sorted(Comparator.comparingInt(e -> Integer.parseInt(e.getKey())))
                                                .map((e) -> {
                                                    if ("image".equals(headerType)) {
                                                        return createImageParameter(e.getValue(), e.getValue(),
                                                                "image.png");
                                                    }
                                                    return createDocumentParameter(null, e.getValue(), "file.pdf");
                                                })
                                                .collect(Collectors.toList());

                        Component headerComponent = null;
                        if (!headerParameters.isEmpty())
                            headerComponent = createHeaderComponent(headerParameters);

                        // Build button component if button params provided
                        Component buttonComponent = null;
                        if (buttonParams != null && buttonParams.get(phoneNumber) != null) {
                            Map<String, String> btnParams = buttonParams.get(phoneNumber);
                            List<Parameter> buttonParameters = btnParams.entrySet().stream()
                                    .sorted(Comparator.comparingInt(e -> Integer.parseInt(e.getKey())))
                                    .map(e -> createTextParameter(e.getValue()))
                                    .collect(Collectors.toList());

                            // Create button component with sub_type "url" and index "0"
                            buttonComponent = new Component("button", "url", "0", buttonParameters);
                        }

                        // Build components list: body, header (if exists), button (if exists)
                        List<Component> components = new ArrayList<>();
                        components.add(bodyComponent);
                        if (headerComponent != null) {
                            components.add(headerComponent);
                        }
                        if (buttonComponent != null) {
                            components.add(buttonComponent);
                        }

                        ResponseEntity<String> response = sendTemplateMessage(
                                phoneNumber,
                                templateName,
                                languageCode,
                                components,
                                accessToken, appId);

                        log.info("Whatsapp Response: " + response.getBody());

                        return Map.of(phoneNumber, response.getStatusCode().is2xxSuccessful());
                    } catch (Exception e) {
                        SentryLogger.SentryEventBuilder.error(e)
                                .withMessage("Failed to send WhatsApp via Meta to individual recipient")
                                .withTag("notification.type", "WHATSAPP")
                                .withTag("whatsapp.provider", "META")
                                .withTag("template.name", templateName)
                                .withTag("recipient.phone", phoneNumber)
                                .withTag("language.code", languageCode != null ? languageCode : "unknown")
                                .withTag("operation", "sendViaMeta")
                                .send();
                        return Map.of(phoneNumber, false);
                    }
                })
                .collect(Collectors.toList());

        // Log each sent message to notification_log table
        logWhatsAppMessages(templateName, bodyParams, headerParams, languageCode, headerType, "META", results);

        return results;
    }

    public ResponseEntity<String> sendTemplateMessage(String toNumber, String templateName,
            String languageCode, List<Component> components, String accessToken, String appId) {
        // Create request body (used for both bypass and real call)
        WhatsAppMessageRequest request = new WhatsAppMessageRequest(
                "whatsapp",
                toNumber,
                "template",
                new Template(
                        templateName,
                        new Language(languageCode),
                        components));
        String jsonRequest;
        try {
            jsonRequest = objectMapper.writeValueAsString(request);
        } catch (Exception e) {
            jsonRequest = "{\"error\":\"failed to serialize request\"}";
        }
        String logId = externalCommunicationLogService.start(ExternalCommunicationSource.WHATSAPP, null, request);
        // API bypass removed - now making actual calls to Meta WhatsApp API

        try {
            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(accessToken);

            // Convert request to JSON
            jsonRequest = objectMapper.writeValueAsString(request);

            // Create HTTP entity
            HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);

            // Send request
            ResponseEntity<String> response = restTemplate.exchange(
                    "https://graph.facebook.com/v22.0/" + appId + "/messages", HttpMethod.POST, entity, String.class);
            externalCommunicationLogService.markSuccess(logId, response.getBody());
            return response;
        } catch (Exception e) {
            externalCommunicationLogService.markFailure(logId, e.getMessage(), null);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp template message")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("template.name", templateName)
                    .withTag("recipient.phone", toNumber)
                    .withTag("language.code", languageCode != null ? languageCode : "unknown")
                    .withTag("whatsapp.app.id", appId != null ? appId : "unknown")
                    .withTag("operation", "sendTemplateMessage")
                    .send();
            throw new RuntimeException("Failed to send WhatsApp message", e);
        }
    }

    // Data model classes
    public record WhatsAppMessageRequest(
            String messaging_product,
            String to,
            String type,
            Template template) {
    }

    public record Template(
            String name,
            Language language,
            List<Component> components) {
    }

    public record Language(String code) {
    }

    public record Component(
            String type,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String sub_type,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) String index,
            List<Parameter> parameters) {

        // Constructor for components without sub_type and index (body, header)
        public Component(String type, List<Parameter> parameters) {
            this(type, null, null, parameters);
        }
    }

    public record Parameter(
            String type,
            String text,
            Image image,

            Document document,
            Currency currency,
            DateTime date_time) {
    }

    public record Currency(
            String fallback_value,
            String code,
            Long amount_1000) {
    }

    public record DateTime(
            String fallback_value,
            String timestamp) {
    }

    public record Image(
            String link,
            String caption) {
    }

    public record Document(
            String link,
            String id,

            String filename) {
    }

    /**
     * Log WhatsApp messages to notification_log table
     */
    private void logWhatsAppMessages(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            String languageCode,
            String headerType,
            String provider,
            List<Map<String, Boolean>> results) {
        try {
            List<NotificationLog> logs = new ArrayList<>();

            for (int i = 0; i < bodyParams.size() && i < results.size(); i++) {
                Map<String, Map<String, String>> userDetail = bodyParams.get(i);
                Map<String, Boolean> result = results.get(i);

                // Extract phone number (first key in the map)
                String phoneNumber = userDetail.keySet().iterator().next();
                Map<String, String> params = userDetail.get(phoneNumber);

                // Extract userId if present in params
                String userId = params.getOrDefault("userId", params.getOrDefault("user_id", null));

                // Get send status
                Boolean sendSuccess = result.get(phoneNumber);

                // Build payload JSON
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

                // Build body message for display
                String bodyMessage = String.format("WhatsApp Template: %s | Provider: %s | Status: %s | Params: %s",
                        templateName, provider, sendSuccess ? "SUCCESS" : "FAILED", params);

                // Create notification log
                NotificationLog log = new NotificationLog();
                log.setNotificationType("WHATSAPP");
                log.setChannelId(phoneNumber);
                log.setBody(bodyMessage);
                log.setSource("whatsapp-service");
                log.setSourceId(templateName);
                log.setUserId(userId);
                log.setNotificationDate(LocalDateTime.now());
                log.setMessagePayload(payloadJson);

                logs.add(log);
            }

            // Batch save all logs
            if (!logs.isEmpty()) {
                notificationLogRepository.saveAll(logs);
                log.info("Logged {} WhatsApp messages to notification_log table", logs.size());
            }

        } catch (Exception e) {
            log.error("Failed to log WhatsApp messages to notification_log: {}", e.getMessage(), e);
            // Don't throw - logging failure shouldn't break the flow
        }
    }
}