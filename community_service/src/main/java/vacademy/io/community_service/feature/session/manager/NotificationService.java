package vacademy.io.community_service.feature.session.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;

@Service
public class NotificationService {

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private final String emailApiUrl = "https://backend-stage.vacademy.io/notification-service/v1/send-email-to-users-public";

    public void sendEmail(EmailRequestDto emailRequest) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        try {
            HttpEntity<EmailRequestDto> requestEntity = new HttpEntity<>(emailRequest, headers);
            restTemplate.postForEntity(emailApiUrl, requestEntity, String.class);
            System.out.println("Successfully sent notification request for subject: " + emailRequest.getSubject());
        } catch (Exception e) {
            System.err.println("Failed to send email notification. Error: " + e.getMessage());
            // Depending on requirements, you might want to re-throw this as a custom exception
        }
    }
}