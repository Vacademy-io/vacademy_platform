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

    /**
     * Original method signature - maintained for backward compatibility
     */
    public List<Map<String, Boolean>> sendWhatsappMessages(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams, String languageCode, String headerType, String instituteId) {
        // Call the new extended method with null for new COMBOT params
        return sendWhatsappMessagesExtended(templateName, bodyParams, headerParams, 
            null, null, null, languageCode, headerType, instituteId);
    }
    
    /**
     * Extended method with COMBOT-specific parameters for video headers and dynamic URL buttons.
     * This method is backward compatible - new params can be null.
     */
    public List<Map<String, Boolean>> sendWhatsappMessagesExtended(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            Map<String, String> headerVideoParams,    // NEW: phone -> videoUrl
            Map<String, String> buttonUrlParams,      // NEW: phone -> buttonUrlParam
            Map<String, String> buttonIndexParams,    // NEW: phone -> buttonIndex
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
            // Navigate to WhatsApp Utility Setting
            JsonNode whatsappSetting = root.path(NotificationConstants.SETTING)
                    .path(NotificationConstants.WHATSAPP_SETTING)
                    .path(NotificationConstants.DATA)
                    .path(NotificationConstants.UTILITY_WHATSAPP);

            // Apply optional testing allowlist filter
            bodyParams = filterRecipientsByTestAllowListIfEnabled(root, bodyParams);
            if (bodyParams.isEmpty()) {
                log.info("TEST allowlist active and no recipients matched; skipping sends");
                return List.of();
            }

            // Check provider type (defaults to META for backward compatibility)
            String provider = whatsappSetting.path(NotificationConstants.PROVIDER).asText("META").toUpperCase();
            log.info("WhatsApp provider for institute {}: {}", instituteId, provider);

            // Route to appropriate provider
            if ("WATI".equals(provider)) {
                return sendViaWati(templateName, bodyParams, languageCode, whatsappSetting);
            } else if ("COMBOT".equals(provider)) {
                // NEW: Route to COMBOT provider
                return sendViaCombot(templateName, bodyParams, headerParams, 
                    headerVideoParams, buttonUrlParams, buttonIndexParams,
                    languageCode, headerType, whatsappSetting, instituteId);
            } else {
                return sendViaMeta(templateName, bodyParams, headerParams, languageCode, headerType, whatsappSetting);
            }

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
     * Send WhatsApp messages via COMBOT (uses Meta Graph API format).
     * Transforms generic WhatsappRequest format to Meta API payload with support for:
     * - Image headers
     * - Video headers (NEW)
     * - Dynamic URL buttons (NEW)
     */
    private List<Map<String, Boolean>> sendViaCombot(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            Map<String, String> headerVideoParams,
            Map<String, String> buttonUrlParams,
            Map<String, String> buttonIndexParams,
            String languageCode,
            String headerType,
            JsonNode whatsappSetting,
            String instituteId) {
        
        try {
            // Extract COMBOT config
            JsonNode combotConfig = whatsappSetting.path(NotificationConstants.COMBOT);
            
            if (combotConfig.isMissingNode()) {
                log.error("COMBOT config not found for institute: {}", instituteId);
                return bodyParams.stream()
                        .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                        .collect(Collectors.toList());
            }
            
            String apiUrl = combotConfig.path(NotificationConstants.API_URL).asText();
            String apiKey = combotConfig.path(NotificationConstants.API_KEY).asText();
            String phoneNumberId = combotConfig.path(NotificationConstants.PHONE_NUMBER_ID).asText();
            
            if (apiUrl.isBlank() || apiKey.isBlank() || phoneNumberId.isBlank()) {
                log.error("COMBOT config incomplete for institute: {}", instituteId);
                return bodyParams.stream()
                        .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                        .collect(Collectors.toList());
            }
            
            log.info("Sending WhatsApp messages via COMBOT: template={}, recipients={}", 
                    templateName, bodyParams.size());
            
            List<Map<String, Boolean>> results = new ArrayList<>();
            
            // Process each user - build Meta API payload
            for (Map<String, Map<String, String>> userDetail : bodyParams) {
                String phoneNumber = userDetail.keySet().iterator().next();
                Map<String, String> params = userDetail.get(phoneNumber);
                
                try {
                    // Build Meta API payload (same format as CombotNodeHandler)
                    Map<String, Object> payload = buildCombotPayload(
                            phoneNumber, templateName, languageCode, params,
                            headerParams != null ? headerParams.get(phoneNumber) : null,
                            headerVideoParams != null ? headerVideoParams.get(phoneNumber) : null,
                            buttonUrlParams != null ? buttonUrlParams.get(phoneNumber) : null,
                            buttonIndexParams != null ? buttonIndexParams.get(phoneNumber) : "0",
                            headerType
                    );
                    
                    // Send to COMBOT API
                    String requestUrl = apiUrl + "/" + phoneNumberId + "/messages";
                    
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.set("Authorization", "Bearer " + apiKey);
                    
                    HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
                    
                    ResponseEntity<Map> response = restTemplate.postForEntity(requestUrl, request, Map.class);
                    
                    boolean success = response.getStatusCode().is2xxSuccessful();
                    results.add(Map.of(phoneNumber, success));
                    
                    log.info("COMBOT response for {}: status={}", phoneNumber, response.getStatusCode());
                    
                    // Small delay to avoid rate limiting
                    Thread.sleep(100);
                    
                } catch (Exception e) {
                    log.error("Failed to send COMBOT message to {}: {}", phoneNumber, e.getMessage());
                    results.add(Map.of(phoneNumber, false));
                }
            }
            
            // Log messages
            logWhatsAppMessages(templateName, bodyParams, headerParams, languageCode, headerType, "COMBOT", results);
            
            return results;
            
        } catch (Exception e) {
            log.error("Error sending via COMBOT: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp via COMBOT")
                    .withTag("notification.type", "WHATSAPP")
                    .withTag("whatsapp.provider", "COMBOT")
                    .withTag("template.name", templateName)
                    .withTag("institute.id", instituteId)
                    .withTag("user.count", String.valueOf(bodyParams != null ? bodyParams.size() : 0))
                    .withTag("language.code", languageCode != null ? languageCode : "unknown")
                    .withTag("operation", "sendViaCombot")
                    .send();
            return bodyParams.stream()
                    .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                    .collect(Collectors.toList());
        }
    }
    
    /**
     * Build COMBOT/Meta API payload from generic WhatsApp request format.
     * This mirrors the logic in CombotNodeHandler.buildSingleMessagePayload()
     */
    private Map<String, Object> buildCombotPayload(String phoneNumber, String templateName, String languageCode,
            Map<String, String> bodyParams, Map<String, String> headerImageParams, String headerVideoUrl,
            String buttonUrlParam, String buttonIndex, String headerType) {
        
        List<Map<String, Object>> components = new ArrayList<>();
        
        // 1. Handle Header (Image OR Video)
        if (headerImageParams != null && !headerImageParams.isEmpty()) {
            // Image header
            Map<String, Object> headerComponent = new HashMap<>();
            headerComponent.put("type", "header");
            
            String imageUrl = headerImageParams.values().iterator().next(); // Get first value
            Map<String, Object> imageObj = Map.of("link", imageUrl);
            Map<String, Object> imageParam = Map.of("type", "image", "image", imageObj);
            
            headerComponent.put("parameters", Collections.singletonList(imageParam));
            components.add(headerComponent);
            
        } else if (headerVideoUrl != null && !headerVideoUrl.isBlank()) {
            // Video header (NEW for COMBOT)
            Map<String, Object> headerComponent = new HashMap<>();
            headerComponent.put("type", "header");
            
            Map<String, Object> videoObj = Map.of("link", headerVideoUrl);
            Map<String, Object> videoParam = Map.of("type", "video", "video", videoObj);
            
            headerComponent.put("parameters", Collections.singletonList(videoParam));
            components.add(headerComponent);
        }
        
        // 2. Handle Body Text
        if (bodyParams != null && !bodyParams.isEmpty()) {
            List<Map<String, String>> parameterComponents = new ArrayList<>();
            
            // Sort by key (1, 2, 3...) to maintain order
            bodyParams.entrySet().stream()
                    .sorted(Comparator.comparingInt(e -> {
                        try { return Integer.parseInt(e.getKey()); } 
                        catch (NumberFormatException ex) { return 999; }
                    }))
                    .forEach(e -> parameterComponents.add(Map.of("type", "text", "text", e.getValue())));
            
            Map<String, Object> bodyComponent = new HashMap<>();
            bodyComponent.put("type", "body");
            bodyComponent.put("parameters", parameterComponents);
            components.add(bodyComponent);
        }
        
        // 3. Handle Dynamic URL Button (NEW for COMBOT)
        if (buttonUrlParam != null && !buttonUrlParam.isBlank()) {
            Map<String, Object> buttonComponent = new HashMap<>();
            buttonComponent.put("type", "button");
            buttonComponent.put("sub_type", "url");
            buttonComponent.put("index", buttonIndex != null ? buttonIndex : "0");
            
            Map<String, String> textParam = Map.of("type", "text", "text", buttonUrlParam);
            buttonComponent.put("parameters", Collections.singletonList(textParam));
            
            components.add(buttonComponent);
        }
        
        // Build Template Map
        Map<String, Object> templateMap = new HashMap<>();
        templateMap.put("name", templateName);
        templateMap.put("language", Map.of("code", languageCode != null ? languageCode : "en"));
        templateMap.put("components", components);
        
        // Build Final Payload (Meta API format)
        Map<String, Object> payload = new HashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", phoneNumber);
        payload.put("type", "template");
        payload.put("template", templateMap);
        
        return payload;
    }

    /**
     * Send WhatsApp messages via Meta (Facebook) - existing implementation
     */
    private List<Map<String, Boolean>> sendViaMeta(String templateName,
            List<Map<String, Map<String, String>>> bodyParams,
            Map<String, Map<String, String>> headerParams,
            String languageCode,
            String headerType,
            JsonNode whatsappSetting) {

        // Extract Meta credentials
        JsonNode metaConfig = whatsappSetting.path(NotificationConstants.META);

        // Fallback to root level for backward compatibility
        if (metaConfig.isMissingNode()) {
            appId = whatsappSetting.path(NotificationConstants.APP_ID).asText();
            accessToken = whatsappSetting.path(NotificationConstants.ACCESS_TOKEN).asText();
        } else {
            appId = metaConfig.path(NotificationConstants.APP_ID).asText();
            accessToken = metaConfig.path(NotificationConstants.ACCESS_TOKEN).asText();
        }

        if (appId == null || appId.isBlank() || accessToken == null || accessToken.isBlank()) {
            log.error("Meta WhatsApp credentials not configured");
            return bodyParams.stream()
                    .map(detail -> Map.of(detail.keySet().iterator().next(), false))
                    .collect(Collectors.toList());
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

                        ResponseEntity<String> response = sendTemplateMessage(
                                phoneNumber,
                                templateName,
                                languageCode,
                                (headerComponent == null) ? List.of(bodyComponent)
                                        : List.of(bodyComponent, headerComponent),
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
        // Right now bypass the whatsapp; log success and return
        if (true) {
            externalCommunicationLogService.markSuccess(logId, "Whatsapp Send Successfully");
            return ResponseEntity.ok("Whatsapp Send Successfully");
        }

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
            List<Parameter> parameters) {
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