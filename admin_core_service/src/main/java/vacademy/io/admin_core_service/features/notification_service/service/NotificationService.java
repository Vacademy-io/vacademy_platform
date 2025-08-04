package vacademy.io.admin_core_service.features.notification_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification_service.dto.WhatsappRequest;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public String sendEmailToUsers(NotificationDTO notificationDTO) {
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.EMAIL_TO_USERS,
                notificationDTO
        );
        return response.getBody();
    }

    public List<Map<String, Boolean>> sendWhatsappToUsers(WhatsappRequest request) {
        // Call notification microservice via HMAC request
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.SEND_WHATSAPP_TO_USER,
                request
        );

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            // Parse the response body into the expected return type
            return objectMapper.readValue(
                    response.getBody(),
                    new TypeReference<List<Map<String, Boolean>>>() {}
            );
        } catch (JsonProcessingException e) {
            throw new VacademyException("Error parsing WhatsApp send response: " + e.getMessage());
        }
    }

    public Boolean sendGenericHtmlMail(GenericEmailRequest request) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.SEND_HTML_EMAIL, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isMailSent = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isMailSent;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public Boolean sendAttachmentEmail(List<AttachmentNotificationDTO> attachmentNotificationDTOs) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(), notificationServerBaseUrl, NotificationConstant.SEND_ATTACHMENT_EMAIL, attachmentNotificationDTOs);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isMailSent = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isMailSent;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

}
