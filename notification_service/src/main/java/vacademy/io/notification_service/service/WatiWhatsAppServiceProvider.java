package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.notification_service.dto.WhatsAppOTPRequest;
import vacademy.io.notification_service.dto.WhatsAppOTPResponse;

import java.util.ArrayList;
import java.util.List;

@Slf4j
public class WatiWhatsAppServiceProvider implements WhatsAppServiceProvider {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public WatiWhatsAppServiceProvider(ObjectMapper objectMapper, RestTemplate restTemplate) {
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    @Override
    public WhatsAppOTPResponse sendOtp(WhatsAppOTPRequest request, String otp, JsonNode credentials) {
        try {
            // Extract WATI credentials
            // Expecting: "wati": { "apiKey": "...", "apiUrl": "...", "whatsappNumber":
            // "..." }

            String apiKey = null;
            String apiUrl = null;
            String whatsappNumber = null;

            if (credentials.has("wati")) {
                JsonNode watiNode = credentials.get("wati");
                apiKey = watiNode.path("apiKey").asText();
                apiUrl = watiNode.path("apiUrl").asText();
                whatsappNumber = watiNode.path("whatsappNumber").asText();
            }

            if (apiKey == null || apiKey.isEmpty() || apiUrl == null || apiUrl.isEmpty()) {
                log.error("WATI credentials incomplete in node: {}", credentials);
                return WhatsAppOTPResponse.builder()
                        .success(false)
                        .message("WhatsApp (WATI) credentials not configured correctly.")
                        .build();
            }

            // Ensure apiUrl ends with correct endpoint if not already provided
            // Assuming base URL is like https://live-mt-server.wati.io/1024293
            // We need to append /api/v1/sendTemplateMessage
            if (!apiUrl.endsWith("/api/v1/sendTemplateMessage")) {
                if (apiUrl.endsWith("/")) {
                    apiUrl = apiUrl + "api/v1/sendTemplateMessage";
                } else {
                    apiUrl = apiUrl + "/api/v1/sendTemplateMessage";
                }
            }

            // Build WATI Payload using hardcoded structure as per Requirement
            // We ignore request.getSettingJson() for structure, but assume templateName is
            // correct.

            WatiPayload payload = WatiPayload.builder()
                    .template_name(request.getTemplateName())
                    .broadcast_name(request.getTemplateName()) // Using template name as broadcast name
                    .parameters(List.of(
                            WatiParameter.builder()
                                    .name("otp")
                                    .value(otp)
                                    .build()))
                    .build();

            // Call WATI API
            boolean success = callWatiAPI(apiUrl, apiKey, whatsappNumber, request.getPhoneNumber(), payload);

            if (success) {
                log.info("WhatsApp OTP sent successfully (WATI) to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(true)
                        .message("WhatsApp OTP sent successfully via WATI")
                        .otp(otp)
                        .build();
            } else {
                log.error("Failed to send WhatsApp OTP (WATI) to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(false)
                        .message("Failed to send WhatsApp OTP via WATI")
                        .build();
            }

        } catch (Exception e) {
            log.error("Exception in WatiWhatsAppServiceProvider: {}", e.getMessage(), e);
            return WhatsAppOTPResponse.builder()
                    .success(false)
                    .message("Exception sending WATI OTP: " + e.getMessage())
                    .build();
        }
    }

    private boolean callWatiAPI(String url, String apiKey, String senderNumber, String receiverNumber,
            WatiPayload payload) {
        try {
            // WATI usually expects query parameters for 'whatsappNumber' (recipient)
            // But verify the specific API doc.
            // Common pattern: POST /api/v1/sendTemplateMessage?whatsappNumber=91999...

            // Appending query parameter for recipient
            String finalUrl = url + "?whatsappNumber=" + receiverNumber;

            log.info("Calling WATI API: {}", finalUrl);
            log.info("WATI API Payload: {}", objectMapper.writeValueAsString(payload));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", apiKey); // WATI usually uses Bearer XXX or just the key in Auth header?
                                                  // Based on user JSON: "apiKey": "Bearer eyJ..." or just "eyJ..."
                                                  // logic.
                                                  // User JSON key starts with "eyJ...", so we might need to add "Bearer
                                                  // " prefix
                                                  // OR user meant "apiKey": "Bearer eyJ..." (let's check).
                                                  // User provided: "apiKey": "eyJhbG..." (no Bearer prefix in
                                                  // UTILITY_WHATSAPP first example)
                                                  // BUT second example "MARKETING_WHATSAPP" had "Bearer eyJ...".
                                                  // Let's assume we need to handle "Bearer" prefixing if missing.

            String finalAuthHeader = apiKey;
            if (!apiKey.toLowerCase().startsWith("bearer ")) {
                finalAuthHeader = "Bearer " + apiKey;
            }
            headers.set("Authorization", finalAuthHeader);

            HttpEntity<WatiPayload> request = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    finalUrl,
                    HttpMethod.POST,
                    request,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("WATI API call successful. Response: {}", response.getBody());
                return true;
            } else {
                log.error("WATI API call failed. Status: {}, Response: {}", response.getStatusCode(),
                        response.getBody());
                return false;
            }

        } catch (Exception e) {
            log.error("Exception while calling WATI API: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("WATI API call failed")
                    .withTag("notification.type", "WHATSAPP_OTP_WATI")
                    .send();
            return false;
        }
    }

    @Data
    @Builder
    private static class WatiPayload {
        private String template_name;
        private String broadcast_name;
        private List<WatiParameter> parameters;
    }

    @Data
    @Builder
    private static class WatiParameter {
        private String name;
        private String value;
    }
}
