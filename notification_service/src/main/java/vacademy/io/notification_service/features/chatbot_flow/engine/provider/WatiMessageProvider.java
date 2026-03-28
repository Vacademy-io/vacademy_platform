package vacademy.io.notification_service.features.chatbot_flow.engine.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WATI provider — converts generic payloads to WATI's flat API format.
 *
 * Key differences from Meta:
 * - Template params: flat name/value array (not nested components[])
 * - Phone number: query parameter (not in body)
 * - Interactive: dedicated endpoints (/sendInteractiveButtonsMessage, /sendInteractiveListMessage)
 * - Text: /sendSessionMessage/{phone}
 * - Bulk send: native receivers[] array
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class WatiMessageProvider implements ChatbotMessageProvider {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final InstituteInternalService instituteInternalService;

    /** Config cache: instituteId → {config, fetchedAt}. TTL = 5 minutes. */
    private Map<String, CachedConfig> configCache = new ConcurrentHashMap<>();
    private static final long CONFIG_TTL_MS = 5 * 60 * 1000;

    private record CachedConfig(WatiConfig config, long fetchedAt) {
        boolean isExpired() { return System.currentTimeMillis() - fetchedAt > CONFIG_TTL_MS; }
    }

    @Override
    public boolean supports(String channelType) {
        return "WHATSAPP_WATI".equalsIgnoreCase(channelType);
    }

    @Override
    public void sendTemplate(String phone, Map<String, Object> templatePayload,
                              String instituteId, String businessChannelId) {
        WatiConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("WATI config not found for institute: " + instituteId);

        String templateName = (String) templatePayload.get("templateName");

        // Convert body params to WATI's flat name/value format
        @SuppressWarnings("unchecked")
        List<String> bodyParams = (List<String>) templatePayload.getOrDefault("bodyParams", List.of());

        List<Map<String, String>> parameters = new ArrayList<>();

        // Add header media param if present
        @SuppressWarnings("unchecked")
        Map<String, Object> headerConfig = (Map<String, Object>) templatePayload.get("headerConfig");
        if (headerConfig != null) {
            String headerType = (String) headerConfig.getOrDefault("type", "none");
            String url = (String) headerConfig.get("url");
            if (!"none".equals(headerType) && url != null) {
                // WATI convention: header media passed as parameter with descriptive name
                switch (headerType) {
                    case "image" -> parameters.add(Map.of("name", "header_image_url", "value", url));
                    case "video" -> parameters.add(Map.of("name", "header_video_url", "value", url));
                    case "document" -> {
                        parameters.add(Map.of("name", "header_document_url", "value", url));
                        String filename = (String) headerConfig.get("filename");
                        if (filename != null) {
                            parameters.add(Map.of("name", "header_document_filename", "value", filename));
                        }
                    }
                }
            }
        }

        // Add body params as positional (1, 2, 3...)
        for (int i = 0; i < bodyParams.size(); i++) {
            parameters.add(Map.of("name", String.valueOf(i + 1), "value", bodyParams.get(i)));
        }

        // Add button URL suffix params if present
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buttonConfig = (List<Map<String, Object>>) templatePayload.get("buttonConfig");
        if (buttonConfig != null) {
            for (Map<String, Object> btn : buttonConfig) {
                String btnType = (String) btn.get("type");
                if ("url".equals(btnType)) {
                    String suffix = (String) btn.getOrDefault("urlSuffix", "");
                    parameters.add(Map.of("name", "button_url_suffix", "value", suffix));
                }
            }
        }

        // Build WATI single template request
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("broadcast_name", "chatbot_flow_" + templateName);
        payload.put("template_name", templateName);
        payload.put("parameters", parameters);

        String formattedPhone = phone.replaceAll("[^0-9]", "");
        String url = config.apiUrl + "/api/v1/sendTemplateMessage?whatsappNumber=" + formattedPhone;

        sendRequest(config, url, payload);
    }

    @Override
    public void sendInteractive(String phone, Map<String, Object> interactivePayload,
                                 String instituteId, String businessChannelId) {
        WatiConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("WATI config not found for institute: " + instituteId);

        String formattedPhone = phone.replaceAll("[^0-9]", "");
        String interactiveType = (String) interactivePayload.getOrDefault("interactiveType", "button");

        if ("button".equals(interactiveType)) {
            sendInteractiveButtons(config, formattedPhone, interactivePayload);
        } else if ("list".equals(interactiveType)) {
            sendInteractiveList(config, formattedPhone, interactivePayload);
        }
    }

    private void sendInteractiveButtons(WatiConfig config, String phone, Map<String, Object> payload) {
        // WATI interactive buttons format
        Map<String, Object> watiPayload = new LinkedHashMap<>();

        // Header
        @SuppressWarnings("unchecked")
        Map<String, Object> header = (Map<String, Object>) payload.get("header");
        if (header != null) {
            String headerType = (String) header.getOrDefault("type", "Text");
            String headerText = (String) header.getOrDefault("text", "");
            watiPayload.put("header", Map.of("type", headerType, "text", headerText));
        }

        // Body
        String body = (String) payload.getOrDefault("body", "");
        watiPayload.put("body", Map.of("text", body));

        // Footer
        String footer = (String) payload.get("footer");
        if (footer != null) {
            watiPayload.put("footer", Map.of("text", footer));
        }

        // Buttons (max 3)
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buttons = (List<Map<String, Object>>) payload.getOrDefault("buttons", List.of());
        List<Map<String, Object>> watiButtons = new ArrayList<>();
        for (Map<String, Object> btn : buttons) {
            watiButtons.add(Map.of(
                    "type", "reply",
                    "reply", Map.of(
                            "id", btn.getOrDefault("id", ""),
                            "title", btn.getOrDefault("title", "")
                    )
            ));
        }
        watiPayload.put("buttons", watiButtons);

        String url = config.apiUrl + "/api/v1/sendInteractiveButtonsMessage?whatsappNumber=" + phone;
        sendRequest(config, url, watiPayload);
    }

    private void sendInteractiveList(WatiConfig config, String phone, Map<String, Object> payload) {
        Map<String, Object> watiPayload = new LinkedHashMap<>();

        String header = (String) payload.getOrDefault("header", "");
        String body = (String) payload.getOrDefault("body", "");
        String footer = (String) payload.get("footer");
        String buttonText = (String) payload.getOrDefault("listButtonText", "Select");

        watiPayload.put("header", header);
        watiPayload.put("body", body);
        if (footer != null) watiPayload.put("footer", footer);
        watiPayload.put("buttonText", buttonText);
        watiPayload.put("sections", payload.getOrDefault("sections", List.of()));

        String url = config.apiUrl + "/api/v1/sendInteractiveListMessage?whatsappNumber=" + phone;
        sendRequest(config, url, watiPayload);
    }

    @Override
    public void sendText(String phone, String text, String instituteId, String businessChannelId) {
        WatiConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("WATI config not found for institute: " + instituteId);

        String formattedPhone = phone.replaceAll("[^0-9]", "");
        String url = config.apiUrl + "/api/v1/sendSessionMessage/" + formattedPhone;

        sendRequest(config, url, Map.of("messageText", text));
    }

    @Override
    public void sendMedia(String phone, String mediaType, String mediaUrl, String caption,
                           String filename, String instituteId, String businessChannelId) {
        WatiConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("WATI config not found for institute: " + instituteId);

        String formattedPhone = phone.replaceAll("[^0-9]", "");

        // WATI V3: POST /api/ext/v3/conversations/messages/fileViaUrl
        String url = config.apiUrl + "/api/ext/v3/conversations/messages/fileViaUrl";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("target", formattedPhone);
        payload.put("fileUrl", mediaUrl);
        if (caption != null && !caption.isBlank()) {
            payload.put("caption", caption);
        }

        sendRequest(config, url, payload);
    }

    private void sendRequest(WatiConfig config, String url, Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + config.apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("WATI API error: url={}, status={}, body={}", url, response.getStatusCode(), response.getBody());
                throw new RuntimeException("WATI API returned " + response.getStatusCode());
            }
            log.debug("WATI message sent successfully: url={}", url);
        } catch (Exception e) {
            log.error("Failed to send message via WATI: {}", e.getMessage());
            throw e;
        }
    }

    private WatiConfig resolveConfig(String instituteId) {
        // Check cache first
        CachedConfig cached = configCache.get(instituteId);
        if (cached != null && !cached.isExpired()) {
            return cached.config();
        }

        try {
            InstituteInfoDTO institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            String jsonString = institute.getSetting();
            JsonNode root = objectMapper.readTree(jsonString);

            JsonNode whatsappSetting = root.path("setting")
                    .path(NotificationConstants.WHATSAPP_SETTING)
                    .path(NotificationConstants.DATA)
                    .path(NotificationConstants.UTILITY_WHATSAPP);

            if (whatsappSetting.isMissingNode()) {
                whatsappSetting = root.path(NotificationConstants.WHATSAPP_SETTING)
                        .path(NotificationConstants.DATA)
                        .path(NotificationConstants.UTILITY_WHATSAPP);
            }

            WatiConfig config;
            JsonNode wati = whatsappSetting.path("wati");
            if (wati.isMissingNode()) {
                config = new WatiConfig(
                        whatsappSetting.path("apiUrl").asText(whatsappSetting.path("api_url").asText("https://live-server.wati.io")),
                        whatsappSetting.path("apiKey").asText(whatsappSetting.path("api_key").asText("")),
                        whatsappSetting.path("whatsappNumber").asText(whatsappSetting.path("whatsapp_number").asText(""))
                );
            } else {
                config = new WatiConfig(
                        wati.path("apiUrl").asText(wati.path("api_url").asText("https://live-server.wati.io")),
                        wati.path("apiKey").asText(wati.path("api_key").asText("")),
                        wati.path("whatsappNumber").asText(wati.path("whatsapp_number").asText(""))
                );
            }

            configCache.put(instituteId, new CachedConfig(config, System.currentTimeMillis()));
            return config;
        } catch (Exception e) {
            log.error("Failed to resolve WATI config for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private record WatiConfig(String apiUrl, String apiKey, String whatsappNumber) {}
}
