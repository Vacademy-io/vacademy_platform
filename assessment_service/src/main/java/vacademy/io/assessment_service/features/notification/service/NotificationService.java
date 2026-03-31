package vacademy.io.assessment_service.features.notification.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.notification.constants.NotificationConstant;
import vacademy.io.assessment_service.features.notification.dto.NotificationDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;

import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public String sendEmailToUsers(NotificationDTO notificationDTO) {
        // Removed the redundant 'clientName' parameter, we can use the injected
        // clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.EMAIL_TO_USERS,
                notificationDTO);
        return response.getBody();
    }

    public String sendAttachmentEmailToUsers(AttachmentNotificationDTO notificationDTO) {
        // Removed the redundant 'clientName' parameter, we can use the injected
        // clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.ATTACHMENT_EMAIL_TO_USERS,
                List.of(notificationDTO));
        return response.getBody();
    }

    public void sendPushNotificationToUsers(String instituteId, List<String> userIds, String title, String body, java.util.Map<String, String> data) {
        java.util.Map<String, Object> request = new java.util.HashMap<>();
        request.put("institute_id", instituteId);
        request.put("user_ids", userIds);
        request.put("title", title);
        request.put("body", body);
        request.put("data", data != null ? data : java.util.Map.of());

        internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.PUSH_SEND_TO_USERS,
                request);
    }

    public void sendSystemAlertToUsers(String instituteId, List<String> userIds, String title, String body) {
        java.util.Map<String, Object> request = new java.util.HashMap<>();
        request.put("institute_id", instituteId);
        request.put("user_ids", userIds);
        request.put("title", title);
        request.put("body", body);

        internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.SYSTEM_ALERT_SEND_TO_USERS,
                request);
    }
}
