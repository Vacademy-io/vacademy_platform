package vacademy.io.assessment_service.features.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.notification.dto.NotificationDTO;
import vacademy.io.assessment_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.assessment_service.features.notification.dto.unified.UnifiedSendRequest;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class NotificationService {

    private static final String UNIFIED_SEND = "/notification-service/internal/v1/send";

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    public void sendEmailToUsers(NotificationDTO dto) {
        List<UnifiedSendRequest.Recipient> recipients = new ArrayList<>();
        if (dto.getUsers() != null) {
            for (NotificationToUserDTO user : dto.getUsers()) {
                recipients.add(UnifiedSendRequest.Recipient.builder()
                        .email(user.getChannelId())
                        .userId(user.getUserId())
                        .variables(user.getPlaceholders())
                        .build());
            }
        }

        UnifiedSendRequest request = UnifiedSendRequest.builder()
                .instituteId("")
                .channel("EMAIL")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(dto.getSubject())
                        .emailBody(dto.getBody())
                        .emailType("UTILITY_EMAIL")
                        .source(dto.getSource())
                        .sourceId(dto.getSourceId())
                        .build())
                .build();

        try {
            internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(),
                    notificationServerBaseUrl, UNIFIED_SEND, request);
        } catch (Exception e) {
            log.error("Failed to send email via unified API: {}", e.getMessage(), e);
        }
    }

    public void sendAttachmentEmailToUsers(AttachmentNotificationDTO dto) {
        List<UnifiedSendRequest.Recipient> recipients = new ArrayList<>();

        if (dto.getUsers() != null) {
            for (AttachmentUsersDTO user : dto.getUsers()) {
                List<UnifiedSendRequest.Attachment> attachments = new ArrayList<>();
                if (user.getAttachments() != null) {
                    for (AttachmentUsersDTO.AttachmentDTO att : user.getAttachments()) {
                        attachments.add(UnifiedSendRequest.Attachment.builder()
                                .filename(att.getAttachmentName() != null ? att.getAttachmentName() : dto.getAttachmentName())
                                .contentBase64(att.getAttachment())
                                .build());
                    }
                }

                recipients.add(UnifiedSendRequest.Recipient.builder()
                        .email(user.getChannelId())
                        .userId(user.getUserId())
                        .variables(user.getPlaceholders())
                        .attachments(attachments)
                        .build());
            }
        }

        UnifiedSendRequest request = UnifiedSendRequest.builder()
                .instituteId("")
                .channel("EMAIL")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(dto.getSubject())
                        .emailBody(dto.getBody())
                        .emailType(dto.getEmailType() != null ? dto.getEmailType() : "UTILITY_EMAIL")
                        .source(dto.getSource())
                        .sourceId(dto.getSourceId())
                        .build())
                .build();

        try {
            internalClientUtils.makeHmacRequest(
                    clientName, HttpMethod.POST.name(),
                    notificationServerBaseUrl, UNIFIED_SEND, request);
        } catch (Exception e) {
            log.error("Failed to send attachment email via unified API: {}", e.getMessage(), e);
        }
    }
}
