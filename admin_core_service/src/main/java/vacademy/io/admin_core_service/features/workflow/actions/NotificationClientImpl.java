package vacademy.io.admin_core_service.features.workflow.actions;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification_service.service.EmailNotificationService;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationClientImpl implements NotificationClient {

    private final RestTemplate restTemplate;

    private final EmailNotificationService emailNotificationService;

    @Override
    public Map<String, Object> sendWhatsApp(Map<String, Object> item, String body) {
        try {
            String url = "http://notification-service/api/v1/notifications/whatsapp/send";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> payload = new HashMap<>();
            payload.put("to", item.get("mobile_number"));
            payload.put("body", body);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);
            restTemplate.postForEntity(url, req, Map.class);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    @Override
    public Map<String, Object> sendEmail(NotificationDTO notificationDTO) {
      String response =  emailNotificationService.sendEmailToUsers(notificationDTO);
      return Map.of("success", true, "response", response);
    }
}