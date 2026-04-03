package vacademy.io.notification_service.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationSource;
import vacademy.io.notification_service.features.external_communication_log.service.ExternalCommunicationLogService;

import java.util.*;
import java.util.stream.Collectors;

/**
 * WATI (WhatsApp Team Inbox) Integration Service
 *
 * Handles WhatsApp message sending via WATI API
 * API Documentation: https://docs.wati.io
 */
@Service
@Slf4j
public class WatiService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final ExternalCommunicationLogService externalCommunicationLogService;

    public WatiService(
            vacademy.io.notification_service.features.external_communication_log.service.ExternalCommunicationLogService externalCommunicationLogService) {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        this.externalCommunicationLogService = externalCommunicationLogService;
    }

    /**
     * Send template messages via WATI API
     *
     * @param templateName  WATI template name
     * @param userDetails   List of phone numbers with their parameter values
     * @param languageCode  Language code (e.g., "en", "hi")
     * @param apiKey        WATI API key
     * @param apiUrl        WATI API base URL
     * @param broadcastName Name for this broadcast campaign
     * @return List of send results (phone -> success/failure)
     */
    public List<Map<String, Boolean>> sendTemplateMessages(
            String templateName,
            List<Map<String, Map<String, String>>> userDetails,
            String languageCode,
            String apiKey,
            String apiUrl,
            String broadcastName) {

        log.info("Sending WATI template messages (bulk): template={}, recipients={}, apiUrl={}",
                templateName, userDetails.size(), apiUrl);

        // Deduplicate based on phone number
        Map<String, Map<String, String>> uniqueUsers = userDetails.stream()
                .collect(Collectors.toMap(
                        detail -> detail.keySet().iterator().next(),
                        detail -> detail.get(detail.keySet().iterator().next()),
                        (existing, replacement) -> existing));

        // Build bulk request
        WatiTemplateRequest request = new WatiTemplateRequest();
        request.setTemplateName(templateName);
        request.setBroadcastName(broadcastName != null ? broadcastName : "Notification");

        List<WatiReceiver> receivers = new ArrayList<>();
        for (Map.Entry<String, Map<String, String>> entry : uniqueUsers.entrySet()) {
            String phoneNumber = entry.getKey();
            Map<String, String> params = entry.getValue();

            String formattedPhone = phoneNumber.replaceAll("[^0-9]", "");
            WatiReceiver receiver = new WatiReceiver();
            receiver.setWhatsappNumber(formattedPhone);

            List<WatiCustomParam> customParams = new ArrayList<>();

            // Convert special _prefixed variables to WATI media params
            String headerUrl = params.get("_headerUrl");
            String headerType = params.get("_headerType");
            if (headerUrl != null) {
                String watiParamName = switch (headerType != null ? headerType : "image") {
                    case "video" -> "header_video_url";
                    case "document" -> "header_document_url";
                    default -> "header_image_url";
                };
                WatiCustomParam mediaParam = new WatiCustomParam();
                mediaParam.setName(watiParamName);
                mediaParam.setValue(headerUrl);
                customParams.add(mediaParam);
            }

            String buttonUrl = params.get("_buttonUrl");
            if (buttonUrl != null) {
                WatiCustomParam btnParam = new WatiCustomParam();
                btnParam.setName("button_url_suffix");
                btnParam.setValue(buttonUrl);
                customParams.add(btnParam);
            }

            // Add body params: filter out _ prefixed keys, sort numerically
            List<WatiCustomParam> bodyCustomParams = params.entrySet().stream()
                    .filter(e -> !e.getKey().startsWith("_"))
                    .sorted((e1, e2) -> {
                        try {
                            int k1 = Integer.parseInt(e1.getKey());
                            try {
                                int k2 = Integer.parseInt(e2.getKey());
                                return Integer.compare(k1, k2);
                            } catch (NumberFormatException ex2) {
                                return 1;
                            }
                        } catch (NumberFormatException ex1) {
                            try {
                                Integer.parseInt(e2.getKey());
                                return -1;
                            } catch (NumberFormatException ex2) {
                                return e1.getKey().compareTo(e2.getKey());
                            }
                        }
                    })
                    .map(e -> {
                        WatiCustomParam param = new WatiCustomParam();
                        param.setName(e.getKey());
                        param.setValue(e.getValue());
                        return param;
                    })
                    .collect(Collectors.toList());
            customParams.addAll(bodyCustomParams);

            receiver.setCustomParams(customParams);
            receivers.add(receiver);
        }
        request.setReceivers(receivers);

        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        try {
            String jsonRequest = objectMapper.writeValueAsString(request);
            log.info("WATI Bulk Request: template={}, receivers={}, apiUrl={}", templateName, uniqueUsers.size(), apiUrl);
            if (log.isDebugEnabled()) {
                log.debug("WATI Bulk Request body: {}", jsonRequest);
            }
            String logId = externalCommunicationLogService.start(ExternalCommunicationSource.WHATSAPP, null, request);
            HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);

            String endpoint = apiUrl + "/api/v1/sendTemplateMessages";
            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, entity, String.class);
            boolean success = response.getStatusCode().is2xxSuccessful();
            log.info("WATI Bulk Response: status={}, body={}", response.getStatusCode(), response.getBody());
            externalCommunicationLogService.markSuccess(logId, response.getBody());

            // Check WATI response body for actual delivery status
            if (success && response.getBody() != null) {
                try {
                    JsonNode respJson = objectMapper.readTree(response.getBody());
                    boolean result = respJson.path("result").asBoolean(true);
                    if (!result) {
                        String info = respJson.path("info").asText("unknown error");
                        log.error("WATI API returned success=false: {}", info);
                        success = false;
                    }
                } catch (Exception ignored) {}
            }

            return uniqueUsers.keySet().stream()
                    .map(phone -> Map.of(phone, success))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to send WATI bulk message: {}", e.getMessage(), e);
            // Best effort: if logging hadn't started, create one just to mark failure
            try {
                String fallbackId = externalCommunicationLogService.start(ExternalCommunicationSource.WHATSAPP, null,
                        "WATI request failed");
                externalCommunicationLogService.markFailure(fallbackId, e.getMessage(), null);
            } catch (Exception ignored) {
            }
            return uniqueUsers.keySet().stream()
                    .map(phone -> Map.of(phone, false))
                    .collect(Collectors.toList());
        }
    }

    @Data
    public static class WatiTemplateRequest {
        @JsonProperty("template_name")
        private String templateName;
        @JsonProperty("broadcast_name")
        private String broadcastName;
        private List<WatiReceiver> receivers;
    }

    @Data
    public static class WatiReceiver {
        private String whatsappNumber;
        private List<WatiCustomParam> customParams;
    }

    @Data
    public static class WatiCustomParam {
        private String name;
        private String value;
    }

    @Data
    public static class WatiMessageResponse {
        private Boolean result;
        private String info;
        private String messageId;
    }
}
