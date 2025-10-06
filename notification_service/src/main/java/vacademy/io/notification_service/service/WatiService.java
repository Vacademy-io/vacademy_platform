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
        
        log.info("Sending WATI template messages: template={}, recipients={}", 
                templateName, userDetails.size());
        
        // Deduplicate based on phone number
        Map<String, Map<String, String>> uniqueUsers = userDetails.stream()
                .collect(Collectors.toMap(
                        detail -> detail.keySet().iterator().next(),  // Phone number as key
                        detail -> detail.get(detail.keySet().iterator().next()),  // Params as value
                        (existing, replacement) -> existing  // Keep first entry on duplicates
                ));
        
        return uniqueUsers.entrySet().stream()
                .map(entry -> {
                    String phoneNumber = entry.getKey();
                    Map<String, String> params = entry.getValue();
                    
                    try {
                        ResponseEntity<String> response = sendSingleTemplateMessage(
                                phoneNumber,
                                templateName,
                                params,
                                languageCode,
                                apiKey,
                                apiUrl,
                                broadcastName
                        );
                        
                        log.info("WATI Response for {}: {}", phoneNumber, response.getStatusCode());
                        
                        return Map.of(phoneNumber, response.getStatusCode().is2xxSuccessful());
                    } catch (Exception e) {
                        log.error("Failed to send WATI message to {}: {}", phoneNumber, e.getMessage(), e);
                        return Map.of(phoneNumber, false);
                    }
                })
                .collect(Collectors.toList());
    }
    
    /**
     * Send template message to a single recipient
     */
    private ResponseEntity<String> sendSingleTemplateMessage(
            String phoneNumber,
            String templateName,
            Map<String, String> params,
            String languageCode,
            String apiKey,
            String apiUrl,
            String broadcastName) throws Exception {
        
        // Ensure phone number is in correct format (no + or -, just digits)
        String formattedPhone = phoneNumber.replaceAll("[^0-9]", "");
        
        // Build WATI request
        WatiTemplateRequest request = new WatiTemplateRequest();
        request.setTemplateName(templateName);
        request.setBroadcastName(broadcastName != null ? broadcastName : "Notification");
        
        // Build receivers list
        List<WatiReceiver> receivers = new ArrayList<>();
        WatiReceiver receiver = new WatiReceiver();
        receiver.setWhatsappNumber(formattedPhone);
        
        // Convert parameters to WATI format
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
        request.setReceivers(receivers);
        
        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        
        // Convert request to JSON
        String jsonRequest = objectMapper.writeValueAsString(request);
        log.debug("WATI Request: {}", jsonRequest);
        
        // Create HTTP entity
        HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);
        
        // Send request
        String endpoint = apiUrl + "/api/v1/sendTemplateMessage";
        return restTemplate.exchange(endpoint, HttpMethod.POST, entity, String.class);
    }
    
    /**
     * Send session message (within 24-hour window)
     * 
     * @param phoneNumber Recipient phone number
     * @param messageText Message text to send
     * @param apiKey WATI API key
     * @param apiUrl WATI API base URL
     * @return Response entity
     */
    public ResponseEntity<String> sendSessionMessage(
            String phoneNumber,
            String messageText,
            String apiKey,
            String apiUrl) throws Exception {
        
        // Ensure phone number is in correct format
        String formattedPhone = phoneNumber.replaceAll("[^0-9]", "");
        
        // Build WATI session message request
        Map<String, String> request = new HashMap<>();
        request.put("whatsappNumber", formattedPhone);
        request.put("message", messageText);
        
        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        
        // Convert request to JSON
        String jsonRequest = objectMapper.writeValueAsString(request);
        log.debug("WATI Session Message Request: {}", jsonRequest);
        
        // Create HTTP entity
        HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);
        
        // Send request
        String endpoint = apiUrl + "/api/v1/sendSessionMessage/" + formattedPhone;
        return restTemplate.exchange(endpoint, HttpMethod.POST, entity, String.class);
    }
    
    /**
     * Check message status
     * 
     * @param messageId WATI message ID
     * @param apiKey WATI API key
     * @param apiUrl WATI API base URL
     * @return Message status response
     */
    public ResponseEntity<String> getMessageStatus(
            String messageId,
            String apiKey,
            String apiUrl) throws Exception {
        
        // Create headers
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        
        // Create HTTP entity
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        
        // Send request
        String endpoint = apiUrl + "/api/v1/getMessageStatus/" + messageId;
        return restTemplate.exchange(endpoint, HttpMethod.GET, entity, String.class);
    }
    
    // ==================== WATI API Data Models ====================
    
    @Data
    public static class WatiTemplateRequest {
        private String templateName;
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
