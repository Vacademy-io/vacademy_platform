package vacademy.io.admin_core_service.features.notification_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.notification.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.UnifiedSendRequest;
import vacademy.io.admin_core_service.features.notification.dto.UnifiedSendResponse;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;
import vacademy.io.common.logging.SentryLogger;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class NotificationService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public String sendEmailToUsers(NotificationDTO notificationDTO, String instituteId) {
        String url = NotificationConstant.EMAIL_TO_USERS + "?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                url,
                notificationDTO);
        return response.getBody();
    }

    public Boolean sendGenericHtmlMail(GenericEmailRequest request) {
        return sendGenericHtmlMail(request, null);
    }

    public Boolean sendGenericHtmlMail(GenericEmailRequest request, String instituteId) {
        String endpoint = NotificationConstant.SEND_HTML_EMAIL;
        if (StringUtils.hasText(instituteId)) {
            endpoint += "?instituteId=" + instituteId;
        }

        // If emailType is not set in the request, default to UTILITY_EMAIL
        if (request.getEmailType() == null || request.getEmailType().isEmpty()) {
            request.setEmailType("UTILITY_EMAIL");
        }

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(),
                notificationServerBaseUrl, endpoint, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isMailSent = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isMailSent;
        } catch (JsonProcessingException e) {
            SentryLogger.logError(e, "Failed to parse generic HTML email send response", Map.of(
                    "notification.type", "EMAIL",
                    "email.type", "HTML",
                    "institute.id", instituteId != null ? instituteId : "unknown",
                    "has.recipient", String.valueOf(request.getTo() != null),
                    "operation", "sendGenericHtmlMail"));
            throw new VacademyException(e.getMessage());
        }
    }

    public Boolean sendAttachmentEmail(List<AttachmentNotificationDTO> attachmentNotificationDTOs, String instituteId) {
        String endpoint = NotificationConstant.SEND_ATTACHMENT_EMAIL;
        if (StringUtils.hasText(instituteId)) {
            endpoint += "?instituteId=" + instituteId;
        }

        // Set emailType to UTILITY_EMAIL for invoice emails if not already set
        for (AttachmentNotificationDTO dto : attachmentNotificationDTOs) {
            if (dto.getEmailType() == null || dto.getEmailType().isEmpty()) {
                dto.setEmailType("UTILITY_EMAIL");
            }
        }

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(),
                notificationServerBaseUrl, endpoint, attachmentNotificationDTOs);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isMailSent = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isMailSent;
        } catch (JsonProcessingException e) {
            SentryLogger.logError(e, "Failed to parse attachment email send response", Map.of(
                    "notification.type", "EMAIL",
                    "email.type", "ATTACHMENT",
                    "institute.id", instituteId != null ? instituteId : "unknown",
                    "attachment.count",
                    String.valueOf(attachmentNotificationDTOs != null ? attachmentNotificationDTOs.size() : 0),
                    "operation", "sendAttachmentEmail"));
            throw new VacademyException(e.getMessage());
        }
    }

    public List<Map<String, Boolean>> sendWhatsappToUsers(WhatsappRequest request, String instituteId) {
        String url = NotificationConstant.SEND_WHATSAPP_TO_USER + "?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                url,
                request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            // Parse the response body into the expected return type
            return objectMapper.readValue(
                    response.getBody(),
                    new TypeReference<List<Map<String, Boolean>>>() {
                    });
        } catch (JsonProcessingException e) {
            SentryLogger.logError(e, "Failed to parse WhatsApp send response", Map.of(
                    "notification.type", "WHATSAPP",
                    "institute.id", instituteId,
                    "template.name", request.getTemplateName() != null ? request.getTemplateName() : "unknown",
                    "user.count",
                    String.valueOf(request.getUserDetails() != null ? request.getUserDetails().size() : 0),
                    "operation", "sendWhatsappToUsers"));
            throw new VacademyException("Error parsing WhatsApp send response: " + e.getMessage());
        }
    }

    public String sendEmailToUsersMultiple(List<NotificationDTO> notificationDTOs, String instituteId) {
        String url = NotificationConstant.EMAIL_TO_USERS_MULTIPLE + "?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                url,
                notificationDTOs);
        return response.getBody();
    }

    public String sendWhatsappToUsers(List<WhatsappRequest> requests, String instituteId) {
        log.debug("Sending bulk WhatsApp requests: {}", JsonUtil.toJson(requests));
        String url = NotificationConstant.SEND_WHATSAPP_TO_USER_MULTIPLE + "?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                url,
                requests);
        return response.getBody();
    }

    public void sendPushNotificationToUsers(String instituteId, List<String> userIds, String title, String body, Map<String, String> data) {
        String url = NotificationConstant.PUSH_NOTIFICATION_SEND + "?instituteId=" + instituteId;
        Map<String, Object> requestBody = Map.of(
                "institute_id", instituteId,
                "user_ids", userIds,
                "title", title,
                "body", body,
                "data", data != null ? data : Map.of()
        );
        try {
            internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    notificationServerBaseUrl,
                    url,
                    requestBody);
        } catch (Exception e) {
            SentryLogger.logError(e, "Failed to send push notification", Map.of(
                    "notification.type", "PUSH_NOTIFICATION",
                    "institute.id", instituteId,
                    "user.count", String.valueOf(userIds.size()),
                    "operation", "sendPushNotificationToUsers"));
        }
    }

    public void sendSystemAlertToUsers(String instituteId, List<String> userIds, String title, String body) {
        String url = NotificationConstant.SYSTEM_ALERT_SEND + "?instituteId=" + instituteId;
        Map<String, Object> requestBody = Map.of(
                "institute_id", instituteId,
                "user_ids", userIds,
                "title", title,
                "body", body
        );
        try {
            internalClientUtils.makeHmacRequest(
                    clientName,
                    HttpMethod.POST.name(),
                    notificationServerBaseUrl,
                    url,
                    requestBody);
        } catch (Exception e) {
            SentryLogger.logError(e, "Failed to send system alert", Map.of(
                    "notification.type", "SYSTEM_ALERT",
                    "institute.id", instituteId,
                    "user.count", String.valueOf(userIds.size()),
                    "operation", "sendSystemAlertToUsers"));
        }
    }

    // ==================== Unified Send API ====================

    /**
     * Send notification via the unified API — single endpoint for WhatsApp, Email, Push, System Alert.
     * Supports sync (<=100 recipients) and async batch (>100).
     * New callers should prefer this over the channel-specific methods above.
     */
    public UnifiedSendResponse sendUnified(UnifiedSendRequest request) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.UNIFIED_SEND,
                request);

        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.readValue(response.getBody(), UnifiedSendResponse.class);
        } catch (JsonProcessingException e) {
            SentryLogger.logError(e, "Failed to parse unified send response", Map.of(
                    "notification.type", request.getChannel() != null ? request.getChannel() : "unknown",
                    "institute.id", request.getInstituteId() != null ? request.getInstituteId() : "unknown",
                    "operation", "sendUnified"));
            throw new VacademyException("Error parsing unified send response: " + e.getMessage());
        }
    }

    /**
     * Poll batch status for async sends.
     */
    public UnifiedSendResponse getUnifiedBatchStatus(String batchId) {
        String url = NotificationConstant.UNIFIED_SEND + "/" + batchId + "/status";
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                notificationServerBaseUrl,
                url,
                null);

        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.readValue(response.getBody(), UnifiedSendResponse.class);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Error parsing batch status response: " + e.getMessage());
        }
    }
}
