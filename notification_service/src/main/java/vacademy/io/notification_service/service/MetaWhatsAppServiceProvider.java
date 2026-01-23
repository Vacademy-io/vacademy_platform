package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.notification_service.dto.MetaWhatsAppPayload;
import vacademy.io.notification_service.dto.WhatsAppOTPRequest;
import vacademy.io.notification_service.dto.WhatsAppOTPResponse;

import java.util.ArrayList;
import java.util.List;

@Slf4j
public class MetaWhatsAppServiceProvider implements WhatsAppServiceProvider {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final String metaApiBaseUrl;

    public MetaWhatsAppServiceProvider(ObjectMapper objectMapper, RestTemplate restTemplate, String metaApiBaseUrl) {
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
        this.metaApiBaseUrl = metaApiBaseUrl;
    }

    @Override
    public WhatsAppOTPResponse sendOtp(WhatsAppOTPRequest request, String otp, JsonNode credentials) {
        try {
            // Extract credentials from the 'meta' node (or fallbacks as per original logic)
            // The factory will likely pass the 'UTILITY_META_WHATSAPP' node or similar.
            // But to be safe and match original logic, let's extract access_token and
            // phone_number_id.

            // Note: The credentials passed here are expected to be the specific
            // configuration node.
            // i.e., UTILITY_META_WHATSAPP, or the root if fallback?
            // To preserve EXACT logic, we should probably do the extraction here if not
            // done already.
            // However, the cleanest way is for this class to expect { "meta": {
            // "accessToken":..., "appId":... } }
            // or { "provider": "META", "meta": ... }

            String accessToken = null;
            String phoneNumberId = null;

            if (credentials.has("meta")) {
                JsonNode metaNode = credentials.get("meta");
                accessToken = metaNode.path("accessToken").asText();
                if (accessToken.isEmpty()) {
                    accessToken = metaNode.path("access_token").asText();
                }
                phoneNumberId = metaNode.path("appId").asText();
                if (phoneNumberId.isEmpty()) {
                    phoneNumberId = metaNode.path("phone_number_id").asText();
                }
            } else {
                // Fallback for root level checks (legacy support)
                if (credentials.has("access_token"))
                    accessToken = credentials.get("access_token").asText();
                if (credentials.has("phone_number_id"))
                    phoneNumberId = credentials.get("phone_number_id").asText();
            }

            if (accessToken == null || accessToken.isEmpty() || phoneNumberId == null || phoneNumberId.isEmpty()) {
                log.error("Meta credentials not found in node: {}", credentials);
                return WhatsAppOTPResponse.builder()
                        .success(false)
                        .message("WhatsApp credentials not configured correctly for Meta.")
                        .build();
            }

            // Build Meta API payload
            MetaWhatsAppPayload payload = buildMetaPayload(
                    request.getPhoneNumber(),
                    request.getTemplateName(),
                    request.getLanguageCode(),
                    otp,
                    request.getSettingJson());

            // Call Meta API
            boolean success = callMetaAPI(phoneNumberId, accessToken, payload);

            if (success) {
                log.info("WhatsApp OTP sent successfully (Meta) to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(true)
                        .message("WhatsApp OTP sent successfully via Meta")
                        .otp(otp)
                        .build();
            } else {
                log.error("Failed to send WhatsApp OTP (Meta) to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(false)
                        .message("Failed to send WhatsApp OTP via Meta")
                        .build();
            }

        } catch (Exception e) {
            log.error("Exception in MetaWhatsAppServiceProvider: {}", e.getMessage(), e);
            return WhatsAppOTPResponse.builder()
                    .success(false)
                    .message("Exception sending Meta OTP: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Build Meta WhatsApp API payload from template configuration
     */
    private MetaWhatsAppPayload buildMetaPayload(String phoneNumber, String templateName, String languageCode,
            String otp, String settingJson) {
        try {
            // Parse setting_json to get parameter configuration
            JsonNode settingNode = objectMapper.readTree(settingJson);
            JsonNode parametersNode = settingNode.path("parameters");

            List<MetaWhatsAppPayload.Component> components = new ArrayList<>();

            // Build body component if configured
            if (parametersNode.has("body")) {
                JsonNode bodyParamsConfig = parametersNode.get("body");
                List<MetaWhatsAppPayload.Parameter> bodyParams = new ArrayList<>();

                if (bodyParamsConfig.isArray()) {
                    for (JsonNode paramConfig : bodyParamsConfig) {
                        if ("otp".equals(paramConfig.path("source").asText())) {
                            bodyParams.add(MetaWhatsAppPayload.Parameter.builder()
                                    .type(paramConfig.path("type").asText("text"))
                                    .text(otp)
                                    .build());
                        }
                    }
                }

                if (!bodyParams.isEmpty()) {
                    components.add(MetaWhatsAppPayload.Component.builder()
                            .type("body")
                            .parameters(bodyParams)
                            .build());
                }
            }

            // Build button component if configured
            if (parametersNode.has("button")) {
                JsonNode buttonParamsConfig = parametersNode.get("button");
                List<MetaWhatsAppPayload.Parameter> buttonParams = new ArrayList<>();

                if (buttonParamsConfig.isArray()) {
                    for (JsonNode paramConfig : buttonParamsConfig) {
                        if ("otp".equals(paramConfig.path("source").asText())) {
                            buttonParams.add(MetaWhatsAppPayload.Parameter.builder()
                                    .type(paramConfig.path("type").asText("text"))
                                    .text(otp)
                                    .build());
                        }
                    }
                }

                // Add button component after loop
                // Always use index "0" for URL buttons as required by Meta API
                if (!buttonParams.isEmpty()) {
                    components.add(MetaWhatsAppPayload.Component.builder()
                            .type("button")
                            .subType("url")
                            .index("0") // Meta API requires index 0 for URL buttons
                            .parameters(buttonParams)
                            .build());
                }
            }

            // Build template
            MetaWhatsAppPayload.Template template = MetaWhatsAppPayload.Template.builder()
                    .name(templateName)
                    .language(MetaWhatsAppPayload.Language.builder()
                            .code(languageCode)
                            .build())
                    .components(components)
                    .build();

            // Build final payload
            return MetaWhatsAppPayload.builder()
                    .messagingProduct("whatsapp")
                    .to(phoneNumber)
                    .type("template")
                    .template(template)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse settingJson, using default payload structure: {}", e.getMessage());
            // Fallback to default structure
            return buildDefaultMetaPayload(phoneNumber, templateName, languageCode, otp);
        }
    }

    /**
     * Build default Meta WhatsApp API payload (fallback)
     */
    private MetaWhatsAppPayload buildDefaultMetaPayload(String phoneNumber, String templateName, String languageCode,
            String otp) {
        // Build body parameters
        List<MetaWhatsAppPayload.Parameter> bodyParams = new ArrayList<>();
        bodyParams.add(MetaWhatsAppPayload.Parameter.builder()
                .type("text")
                .text(otp)
                .build());

        // Build button parameters
        List<MetaWhatsAppPayload.Parameter> buttonParams = new ArrayList<>();
        buttonParams.add(MetaWhatsAppPayload.Parameter.builder()
                .type("text")
                .text(otp)
                .build());

        // Build components
        List<MetaWhatsAppPayload.Component> components = new ArrayList<>();

        // Body component
        components.add(MetaWhatsAppPayload.Component.builder()
                .type("body")
                .parameters(bodyParams)
                .build());

        // Button component
        components.add(MetaWhatsAppPayload.Component.builder()
                .type("button")
                .subType("url")
                .index("0")
                .parameters(buttonParams)
                .build());

        // Build template
        MetaWhatsAppPayload.Template template = MetaWhatsAppPayload.Template.builder()
                .name(templateName)
                .language(MetaWhatsAppPayload.Language.builder()
                        .code(languageCode)
                        .build())
                .components(components)
                .build();

        // Build final payload
        return MetaWhatsAppPayload.builder()
                .messagingProduct("whatsapp")
                .to(phoneNumber)
                .type("template")
                .template(template)
                .build();
    }

    /**
     * Call Meta WhatsApp API
     */
    private boolean callMetaAPI(String phoneNumberId, String accessToken, MetaWhatsAppPayload payload) {
        try {
            String url = metaApiBaseUrl + "/" + phoneNumberId + "/messages";
            log.info("Calling Meta API: {}", url);
            log.info("Meta API Payload: {}", objectMapper.writeValueAsString(payload));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(accessToken);

            HttpEntity<MetaWhatsAppPayload> request = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Meta API call successful. Response: {}", response.getBody());
                return true;
            } else {
                log.error("Meta API call failed. Status: {}, Response: {}", response.getStatusCode(),
                        response.getBody());
                return false;
            }

        } catch (Exception e) {
            log.error("Exception while calling Meta API: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Meta API call failed")
                    .withTag("notification.type", "WHATSAPP_OTP")
                    .send();
            return false;
        }
    }
}
