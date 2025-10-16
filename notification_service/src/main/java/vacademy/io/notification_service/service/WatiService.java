package vacademy.io.notification_service.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

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
    
    public WatiService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }
    
    /**
     * Send template messages via WATI API
     * 
     * @param templateName WATI template name
     * @param userDetails List of phone numbers with their parameter values
     * @param languageCode Language code (e.g., "en", "hi")
     * @param apiKey WATI API key
     * @param apiUrl WATI API base URL
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
        
        log.info("Sending WATI template messages (bulk): template={}, recipients={}",
                templateName, userDetails.size());
        
        // Deduplicate based on phone number
        Map<String, Map<String, String>> uniqueUsers = userDetails.stream()
                .collect(Collectors.toMap(
                        detail -> detail.keySet().iterator().next(),
                        detail -> detail.get(detail.keySet().iterator().next()),
                        (existing, replacement) -> existing
                ));
        
        // Build bulk request
        WatiTemplateRequest request = new WatiTemplateRequest();
        request.setTemplateName(templateName);
        request.setBroadcastName(broadcastName != null ? broadcastName : "Notification");
        request.setLanguageCode(languageCode);
        
        List<WatiReceiver> receivers = new ArrayList<>();
        for (Map.Entry<String, Map<String, String>> entry : uniqueUsers.entrySet()) {
            String phoneNumber = entry.getKey();
            Map<String, String> params = entry.getValue();
            
            String formattedPhone = phoneNumber.replaceAll("[^0-9]", "");
            WatiReceiver receiver = new WatiReceiver();
            receiver.setWhatsappNumber(formattedPhone);
            
            List<WatiCustomParam> customParams = params.entrySet().stream()
                    .sorted(Comparator.comparingInt(e -> {
                        try {
                            return Integer.parseInt(e.getKey());
                        } catch (NumberFormatException ex) {
                            return Integer.MAX_VALUE;
                        }
                    }))
                    .map(e -> {
                        WatiCustomParam param = new WatiCustomParam();
                        param.setName(e.getKey());
                        param.setValue(e.getValue());
                        return param;
                    })
                    .collect(Collectors.toList());
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
            log.debug("WATI Bulk Request: {}", jsonRequest);
            HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);
            
            String endpoint = apiUrl + "/api/v1/sendTemplateMessages";
            ResponseEntity<String> response = restTemplate.exchange(endpoint, HttpMethod.POST, entity, String.class);
            boolean success = response.getStatusCode().is2xxSuccessful();
            
            return uniqueUsers.keySet().stream()
                    .map(phone -> Map.of(phone, success))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to send WATI bulk message: {}", e.getMessage(), e);
            return uniqueUsers.keySet().stream()
                    .map(phone -> Map.of(phone, false))
                    .collect(Collectors.toList());
        }
    }
    
    
    @Data
    public static class WatiTemplateRequest {
        private String templateName;
        private String broadcastName;
        private String languageCode;
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
