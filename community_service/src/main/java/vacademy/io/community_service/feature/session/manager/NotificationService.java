package vacademy.io.community_service.feature.session.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import vacademy.io.community_service.feature.session.dto.admin.EmailRequestDto;
import vacademy.io.community_service.feature.session.dto.admin.EmailUserDto;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.*;

@Service
@Slf4j
public class NotificationService {

    private static final String UNIFIED_SEND = "/notification-service/internal/v1/send";

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${NOTIFICATION_SERVER_BASE_URL}")
    private String notificationServerBaseUrl;

    public void sendEmail(EmailRequestDto emailRequest) {
        try {
            // Build unified send request
            List<Map<String, Object>> recipients = new ArrayList<>();
            if (emailRequest.getUsers() != null) {
                for (EmailUserDto user : emailRequest.getUsers()) {
                    Map<String, Object> recipient = new HashMap<>();
                    recipient.put("email", user.getChannelId());
                    recipient.put("userId", user.getUserId());
                    recipient.put("variables", user.getPlaceholders() != null ? user.getPlaceholders() : Map.of());
                    recipients.add(recipient);
                }
            }

            Map<String, Object> options = new HashMap<>();
            options.put("emailSubject", emailRequest.getSubject());
            options.put("emailBody", emailRequest.getBody());
            options.put("emailType", "UTILITY_EMAIL");
            options.put("source", emailRequest.getSource());
            options.put("sourceId", emailRequest.getSourceId());

            Map<String, Object> request = new HashMap<>();
            request.put("instituteId", "");
            request.put("channel", "EMAIL");
            request.put("recipients", recipients);
            request.put("options", options);

            internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(),
                    notificationServerBaseUrl, UNIFIED_SEND, request);

            log.info("Successfully sent notification request for subject: {}", emailRequest.getSubject());
        } catch (Exception e) {
            log.error("Failed to send email notification: {}", e.getMessage(), e);
        }
    }
}
