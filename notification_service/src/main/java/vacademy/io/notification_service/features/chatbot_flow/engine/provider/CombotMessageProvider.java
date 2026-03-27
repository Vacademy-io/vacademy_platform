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

/**
 * COMBOT provider — uses Meta WhatsApp Cloud API format via Com.bot proxy.
 * Also handles direct META channel type since the payload format is identical.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class CombotMessageProvider implements ChatbotMessageProvider {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final InstituteInternalService instituteInternalService;

    @Override
    public boolean supports(String channelType) {
        return "WHATSAPP_COMBOT".equalsIgnoreCase(channelType)
                || "WHATSAPP_META".equalsIgnoreCase(channelType)
                || "WHATSAPP".equalsIgnoreCase(channelType);
    }

    @Override
    public void sendTemplate(String phone, Map<String, Object> templatePayload,
                              String instituteId, String businessChannelId) {
        ProviderConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("COMBOT/META config not found for institute: " + instituteId);

        String templateName = (String) templatePayload.get("templateName");
        String languageCode = (String) templatePayload.getOrDefault("languageCode", "en");

        @SuppressWarnings("unchecked")
        List<String> bodyParams = (List<String>) templatePayload.get("bodyParams");
        @SuppressWarnings("unchecked")
        Map<String, Object> headerConfig = (Map<String, Object>) templatePayload.get("headerConfig");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buttonConfig = (List<Map<String, Object>>) templatePayload.get("buttonConfig");

        // Build Meta API components
        List<Map<String, Object>> components = new ArrayList<>();

        // Header component
        if (headerConfig != null) {
            String headerType = (String) headerConfig.getOrDefault("type", "none");
            if (!"none".equals(headerType)) {
                Map<String, Object> headerComponent = new LinkedHashMap<>();
                headerComponent.put("type", "header");
                String url = (String) headerConfig.get("url");
                String filename = (String) headerConfig.get("filename");

                Map<String, Object> param = new LinkedHashMap<>();
                param.put("type", headerType);
                Map<String, Object> mediaObj = new LinkedHashMap<>();
                mediaObj.put("link", url);
                if ("document".equals(headerType) && filename != null) {
                    mediaObj.put("filename", filename);
                }
                param.put(headerType, mediaObj);
                headerComponent.put("parameters", List.of(param));
                components.add(headerComponent);
            }
        }

        // Body component
        if (bodyParams != null && !bodyParams.isEmpty()) {
            Map<String, Object> bodyComponent = new LinkedHashMap<>();
            bodyComponent.put("type", "body");
            List<Map<String, String>> parameters = new ArrayList<>();
            for (String val : bodyParams) {
                parameters.add(Map.of("type", "text", "text", val));
            }
            bodyComponent.put("parameters", parameters);
            components.add(bodyComponent);
        }

        // Button components
        if (buttonConfig != null) {
            for (Map<String, Object> btn : buttonConfig) {
                String btnType = (String) btn.get("type");
                int index = btn.get("index") instanceof Number ? ((Number) btn.get("index")).intValue() : 0;
                Map<String, Object> buttonComponent = new LinkedHashMap<>();
                buttonComponent.put("type", "button");

                if ("url".equals(btnType)) {
                    buttonComponent.put("sub_type", "url");
                    buttonComponent.put("index", String.valueOf(index));
                    buttonComponent.put("parameters", List.of(
                            Map.of("type", "text", "text", btn.getOrDefault("urlSuffix", ""))));
                } else if ("quick_reply".equals(btnType)) {
                    buttonComponent.put("sub_type", "quick_reply");
                    buttonComponent.put("index", String.valueOf(index));
                    buttonComponent.put("parameters", List.of(
                            Map.of("type", "payload", "payload", btn.getOrDefault("payload", ""))));
                }
                components.add(buttonComponent);
            }
        }

        // Build final payload
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", phone);
        payload.put("type", "template");
        payload.put("template", Map.of(
                "name", templateName,
                "language", Map.of("code", languageCode),
                "components", components
        ));

        sendPayload(config, payload);
    }

    @Override
    public void sendInteractive(String phone, Map<String, Object> interactivePayload,
                                 String instituteId, String businessChannelId) {
        ProviderConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("COMBOT/META config not found for institute: " + instituteId);

        String interactiveType = (String) interactivePayload.getOrDefault("interactiveType", "button");

        Map<String, Object> interactive = new LinkedHashMap<>();
        interactive.put("type", interactiveType);

        // Header
        @SuppressWarnings("unchecked")
        Map<String, Object> header = (Map<String, Object>) interactivePayload.get("header");
        if (header != null) {
            interactive.put("header", header);
        }

        // Body
        String body = (String) interactivePayload.get("body");
        if (body != null) {
            interactive.put("body", Map.of("text", body));
        }

        // Footer
        String footer = (String) interactivePayload.get("footer");
        if (footer != null) {
            interactive.put("footer", Map.of("text", footer));
        }

        // Action (buttons or sections)
        Map<String, Object> action = new LinkedHashMap<>();
        if ("button".equals(interactiveType)) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> buttons = (List<Map<String, Object>>) interactivePayload.get("buttons");
            if (buttons != null) {
                List<Map<String, Object>> apiButtons = new ArrayList<>();
                for (Map<String, Object> btn : buttons) {
                    apiButtons.add(Map.of("type", "reply", "reply",
                            Map.of("id", btn.get("id"), "title", btn.get("title"))));
                }
                action.put("buttons", apiButtons);
            }
        } else if ("list".equals(interactiveType)) {
            action.put("button", interactivePayload.getOrDefault("listButtonText", "Select"));
            action.put("sections", interactivePayload.get("sections"));
        }
        interactive.put("action", action);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", phone);
        payload.put("type", "interactive");
        payload.put("interactive", interactive);

        sendPayload(config, payload);
    }

    @Override
    public void sendText(String phone, String text, String instituteId, String businessChannelId) {
        ProviderConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("COMBOT/META config not found for institute: " + instituteId);

        Map<String, Object> payload = Map.of(
                "messaging_product", "whatsapp",
                "to", phone,
                "type", "text",
                "text", Map.of("body", text)
        );

        sendPayload(config, payload);
    }

    @Override
    public void sendMedia(String phone, String mediaType, String mediaUrl, String caption,
                           String filename, String instituteId, String businessChannelId) {
        ProviderConfig config = resolveConfig(instituteId);
        if (config == null) throw new RuntimeException("COMBOT/META config not found for institute: " + instituteId);

        // Meta API: type determines the media object key
        // { "messaging_product": "whatsapp", "to": "...", "type": "image", "image": { "link": "..." } }
        Map<String, Object> mediaObj = new LinkedHashMap<>();
        mediaObj.put("link", mediaUrl);
        if (caption != null && !caption.isBlank() && !"audio".equals(mediaType)) {
            mediaObj.put("caption", caption);
        }
        if (filename != null && !filename.isBlank() && "document".equals(mediaType)) {
            mediaObj.put("filename", filename);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", phone);
        payload.put("type", mediaType);
        payload.put(mediaType, mediaObj); // "image": {...}, "video": {...}, etc.

        sendPayload(config, payload);
    }

    private void sendPayload(ProviderConfig config, Map<String, Object> payload) {
        String url = config.apiUrl + "/" + config.phoneNumberId + "/messages";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + config.apiKey);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            if (!response.getStatusCode().is2xxSuccessful()) {
                log.error("COMBOT/META API error: status={}, body={}", response.getStatusCode(), response.getBody());
                throw new RuntimeException("WhatsApp API returned " + response.getStatusCode());
            }
            log.debug("COMBOT/META message sent successfully to {}", payload.get("to"));
        } catch (Exception e) {
            log.error("Failed to send message via COMBOT/META: {}", e.getMessage());
            throw e;
        }
    }

    private ProviderConfig resolveConfig(String instituteId) {
        try {
            InstituteInfoDTO institute = instituteInternalService.getInstituteByInstituteId(instituteId);
            String jsonString = institute.getSetting();
            JsonNode root = objectMapper.readTree(jsonString);

            // Navigate: setting.WHATSAPP_SETTING.data.UTILITY_WHATSAPP
            JsonNode whatsappSetting = root.path("setting")
                    .path(NotificationConstants.WHATSAPP_SETTING)
                    .path(NotificationConstants.DATA)
                    .path(NotificationConstants.UTILITY_WHATSAPP);

            if (whatsappSetting.isMissingNode()) {
                // Try without "setting" wrapper
                whatsappSetting = root.path(NotificationConstants.WHATSAPP_SETTING)
                        .path(NotificationConstants.DATA)
                        .path(NotificationConstants.UTILITY_WHATSAPP);
            }

            String provider = whatsappSetting.path("provider").asText("META").toUpperCase();

            if ("COMBOT".equals(provider)) {
                JsonNode combot = whatsappSetting.path("combot");
                return new ProviderConfig(
                        combot.path("apiUrl").asText(combot.path("api_url").asText()),
                        combot.path("apiKey").asText(combot.path("api_key").asText()),
                        combot.path("phone_number_id").asText(combot.path("phoneNumberId").asText())
                );
            } else {
                // Direct META
                JsonNode meta = whatsappSetting.path("meta");
                String accessToken = meta.path("access_token").asText(meta.path("accessToken").asText(
                        whatsappSetting.path("accessToken").asText(whatsappSetting.path("access_token").asText())));
                String phoneNumberId = meta.path("appId").asText(meta.path("phoneNumberId").asText(
                        whatsappSetting.path("appId").asText()));
                return new ProviderConfig(
                        "https://graph.facebook.com/v22.0",
                        accessToken,
                        phoneNumberId
                );
            }
        } catch (Exception e) {
            log.error("Failed to resolve provider config for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private record ProviderConfig(String apiUrl, String apiKey, String phoneNumberId) {}
}
