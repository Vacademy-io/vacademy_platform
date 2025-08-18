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
import vacademy.io.notification_service.institute.InstituteDTO;
import vacademy.io.notification_service.institute.InstituteInternalService;

import java.util.*;
import java.util.stream.Collectors;


@Service
@Slf4j
public class WhatsAppService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    String appId=null;
    String accessToken=null;
    @Autowired
    private InstituteInternalService internalService;

    public WhatsAppService() {

        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
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
                                                           Map<String, Map<String, String>> headerParams, String languageCode, String headerType,String instituteId) {

        if(instituteId!=null){
            InstituteDTO instituteDTO=internalService.getInstituteByInstituteId(instituteId);
            String jsonString=instituteDTO.getSetting();
            System.out.println(instituteDTO);

            try{
                JsonNode root = objectMapper.readTree(jsonString);
                // Navigate to WhatsApp Utility Setting
                JsonNode whatsappSetting = root.path(NotificationConstants.SETTING)
                        .path(NotificationConstants.WHATSAPP_SETTING)
                        .path(NotificationConstants.DATA)
                        .path(NotificationConstants.UTILITY_WHATSAPP);

                appId=whatsappSetting.path(NotificationConstants.APP_ID).asText();
                accessToken=whatsappSetting.path(NotificationConstants.ACCESS_TOKEN).asText();


            }catch (Exception e){
                System.out.println("Exception occur"+e);
                return null;
            }


        }else{
            System.out.println("missing instituteId");
            return null;
        }


        // Deduplicate based on phone number, retaining the first occurrence
        Map<String, Map<String, String>> uniqueUsers = bodyParams.stream()
                .collect(Collectors.toMap(
                        detail -> detail.keySet().iterator().next(),  // Phone number as key
                        detail -> detail.get(detail.keySet().iterator().next()),  // Params as value
                        (existing, replacement) -> existing  // Keep the first entry on duplicates
                ));

        return uniqueUsers.entrySet().stream()
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

                        List<Parameter> headerParameters = (headerParams == null || headerParams.get(phoneNumber) == null) ? Collections.emptyList() : headerParams.get(phoneNumber).entrySet().stream()
                                .sorted(Comparator.comparingInt(e -> Integer.parseInt(e.getKey())))
                                .map((e) -> {
                                    if("image".equals(headerType)) {
                                        return createImageParameter(e.getValue(), e.getValue(), "image.png");
                                    }
                                    return createDocumentParameter(null, e.getValue(), "file.pdf");
                                })
                                .collect(Collectors.toList());

                        Component headerComponent = null;
                        if (!headerParameters.isEmpty()) headerComponent = createHeaderComponent(headerParameters);

                        ResponseEntity<String> response = sendTemplateMessage(
                                phoneNumber,
                                templateName,
                                languageCode,
                                (headerComponent == null) ? List.of(bodyComponent) : List.of(bodyComponent, headerComponent),accessToken,appId
                        );

                        log.info("Whatsapp Response: " + response.getBody());

                        return Map.of(phoneNumber, response.getStatusCode().is2xxSuccessful());
                    } catch (Exception e) {
                        return Map.of(phoneNumber, false);
                    }
                })
                .collect(Collectors.toList());
    }

    public ResponseEntity<String> sendTemplateMessage(String toNumber, String templateName,
                                                      String languageCode, List<Component> components,String accessToken,String appId) {
        try {
            // Create request body
            WhatsAppMessageRequest request = new WhatsAppMessageRequest(
                    "whatsapp",
                    toNumber,
                    "template",
                    new Template(
                            templateName,
                            new Language(languageCode),
                            components
                    )
            );

            // Create headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(accessToken);

            // Convert request to JSON
            String jsonRequest = objectMapper.writeValueAsString(request);

            // Create HTTP entity
            HttpEntity<String> entity = new HttpEntity<>(jsonRequest, headers);

            // Send request
            return restTemplate.exchange("https://graph.facebook.com/v22.0/" + appId+ "/messages", HttpMethod.POST, entity, String.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send WhatsApp message", e);
        }
    }

    // Data model classes
    public record WhatsAppMessageRequest(
            String messaging_product,
            String to,
            String type,
            Template template
    ) {
    }

    public record Template(
            String name,
            Language language,
            List<Component> components
    ) {
    }

    public record Language(String code) {
    }

    public record Component(
            String type,
            List<Parameter> parameters
    ) {
    }

    public record Parameter(
            String type,
            String text,
            Image image,

            Document document,
            Currency currency,
            DateTime date_time
    ) {
    }

    public record Currency(
            String fallback_value,
            String code,
            Long amount_1000
    ) {
    }

    public record DateTime(
            String fallback_value,
            String timestamp
    ) {
    }

    public record Image(
            String link,
            String caption
    ) {
    }

    public record Document(
            String link,
            String id,

            String filename
    ) {
    }
}