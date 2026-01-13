package vacademy.io.notification_service.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.notification_service.dto.WhatsAppTemplateConfigDTO;

@Component
@Slf4j
public class AdminTemplateClient {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${admin.service.base-url:http://localhost:8072}")
    private String adminServiceBaseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Fetch WhatsApp template configuration from admin service
     * 
     * @param eventName   Event name (e.g., "OTP_REQUEST")
     * @param instituteId Institute ID
     * @return WhatsApp template configuration or null if not found/error
     */
    public WhatsAppTemplateConfigDTO getWhatsAppTemplate(String eventName, String instituteId) {
        try {
            String url = "/admin-core-service/institute/template/v1/internal/whatsapp-template?eventName=" + eventName
                    + "&instituteId="
                    + instituteId;

            log.info("Fetching WhatsApp template from admin service: event={}, institute={}", eventName, instituteId);

            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.GET.name(),
                    adminServiceBaseUrl,
                    url,
                    null);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                WhatsAppTemplateConfigDTO template = objectMapper.readValue(
                        response.getBody(),
                        new TypeReference<WhatsAppTemplateConfigDTO>() {
                        });
                log.info("Successfully fetched template: {}", template.getTemplateName());
                return template;
            } else {
                log.warn("Failed to fetch template, status: {}", response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            log.error("Error fetching WhatsApp template from admin service: {}", e.getMessage(), e);
            log.error("Full error details - URL: {}, Base URL: {}, Event: {}, Institute: {}",
                    "/admin-core-service/institute/template/v1/internal/whatsapp-template",
                    adminServiceBaseUrl, eventName, instituteId);
            return null;
        }
    }
}
