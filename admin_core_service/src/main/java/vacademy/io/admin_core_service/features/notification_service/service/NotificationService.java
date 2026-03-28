package vacademy.io.admin_core_service.features.notification_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
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

        if (response == null || response.getBody() == null) {
            throw new VacademyException("Empty response from unified send API");
        }

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

    // ==================== Bridge Methods (old DTO → unified send) ====================

    /**
     * Bridge: converts old NotificationDTO (email) → unified send.
     * Preserves all placeholders as variables. Body + subject contain {{key}} placeholders
     * which notification service resolves per-recipient.
     */
    public UnifiedSendResponse sendEmailViaUnified(NotificationDTO dto, String instituteId) {
        List<UnifiedSendRequest.Recipient> recipients = new java.util.ArrayList<>();
        if (dto.getUsers() != null) {
            for (NotificationToUserDTO user : dto.getUsers()) {
                recipients.add(UnifiedSendRequest.Recipient.builder()
                        .email(user.getChannelId())
                        .userId(user.getUserId())
                        .variables(user.getPlaceholders())
                        .build());
            }
        }

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId)
                .channel("EMAIL")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(dto.getSubject())
                        .emailBody(dto.getBody())
                        .emailType("UTILITY_EMAIL")
                        .source(dto.getSource())
                        .sourceId(dto.getSourceId())
                        .build())
                .build());
    }

    /**
     * Bridge: converts old GenericEmailRequest → unified send.
     * Overload 1: with explicit params
     */
    public UnifiedSendResponse sendHtmlEmailViaUnified(
            String to, String subject, String body, String instituteId,
            String fromEmail, String fromName, String emailType) {

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId != null ? instituteId : "")
                .channel("EMAIL")
                .recipients(List.of(UnifiedSendRequest.Recipient.builder()
                        .email(to).build()))
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(subject)
                        .emailBody(body)
                        .emailType(emailType != null ? emailType : "UTILITY_EMAIL")
                        .fromEmail(fromEmail)
                        .fromName(fromName)
                        .source("html-email")
                        .build())
                .build());
    }

    /**
     * Bridge: List<NotificationDTO> (batch email) → unified send. Sends each DTO sequentially.
     * Drop-in replacement for sendEmailToUsersMultiple.
     */
    public void sendEmailToUsersMultipleViaUnified(List<NotificationDTO> dtos, String instituteId) {
        for (NotificationDTO dto : dtos) {
            try {
                sendEmailViaUnified(dto, instituteId);
            } catch (Exception e) {
                log.error("Failed to send batch email for source {}: {}", dto.getSourceId(), e.getMessage());
            }
        }
    }

    /**
     * Bridge: GenericEmailRequest object → unified send.
     * Drop-in replacement for sendGenericHtmlMail(request, instituteId).
     */
    public UnifiedSendResponse sendGenericHtmlMailViaUnified(GenericEmailRequest request, String instituteId) {
        return sendHtmlEmailViaUnified(
                request.getTo(), request.getSubject(), request.getBody(),
                instituteId, null, null,
                request.getEmailType() != null ? request.getEmailType() : "UTILITY_EMAIL");
    }

    /**
     * Bridge: GenericEmailRequest without instituteId.
     */
    public UnifiedSendResponse sendGenericHtmlMailViaUnified(GenericEmailRequest request) {
        return sendGenericHtmlMailViaUnified(request, null);
    }

    /**
     * Bridge: converts old WhatsappRequest → unified send.
     * Maps the legacy Map<phone, Map<key,value>> format to recipients with variables.
     */
    public UnifiedSendResponse sendWhatsappViaUnified(WhatsappRequest request, String instituteId) {
        List<UnifiedSendRequest.Recipient> recipients = new java.util.ArrayList<>();

        if (request.getUserDetails() != null) {
            for (Map<String, Map<String, String>> userDetail : request.getUserDetails()) {
                for (Map.Entry<String, Map<String, String>> entry : userDetail.entrySet()) {
                    String phone = entry.getKey().replaceAll("[^0-9]", "");
                    recipients.add(UnifiedSendRequest.Recipient.builder()
                            .phone(phone)
                            .variables(entry.getValue())
                            .build());
                }
            }
        }

        UnifiedSendRequest.SendOptions.SendOptionsBuilder optsBuilder =
                UnifiedSendRequest.SendOptions.builder().source("whatsapp-bridge");

        if (request.getHeaderType() != null) {
            optsBuilder.headerType(request.getHeaderType());
        }

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId)
                .channel("WHATSAPP")
                .templateName(request.getTemplateName())
                .languageCode(request.getLanguageCode() != null ? request.getLanguageCode() : "en")
                .recipients(recipients)
                .options(optsBuilder.build())
                .build());
    }

    /**
     * Bridge: List<WhatsappRequest> (batch) → unified send. Sends each request sequentially.
     */
    public void sendWhatsappViaUnified(List<WhatsappRequest> requests, String instituteId) {
        for (WhatsappRequest request : requests) {
            try {
                sendWhatsappViaUnified(request, instituteId);
            } catch (Exception e) {
                log.error("Failed to send WhatsApp batch for template {}: {}",
                        request.getTemplateName(), e.getMessage());
            }
        }
    }

    /**
     * Bridge: push notification → unified send.
     */
    public UnifiedSendResponse sendPushViaUnified(
            String instituteId, List<String> userIds, String title, String body, Map<String, String> data) {

        List<UnifiedSendRequest.Recipient> recipients = userIds.stream()
                .map(id -> UnifiedSendRequest.Recipient.builder().userId(id).build())
                .collect(java.util.stream.Collectors.toList());

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId)
                .channel("PUSH")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .pushTitle(title)
                        .pushBody(body)
                        .pushData(data)
                        .source("push-bridge")
                        .build())
                .build());
    }

    /**
     * Bridge: system alert → unified send.
     */
    public UnifiedSendResponse sendSystemAlertViaUnified(
            String instituteId, List<String> userIds, String title, String body) {

        List<UnifiedSendRequest.Recipient> recipients = userIds.stream()
                .map(id -> UnifiedSendRequest.Recipient.builder().userId(id).build())
                .collect(java.util.stream.Collectors.toList());

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId)
                .channel("SYSTEM_ALERT")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .pushTitle(title)
                        .pushBody(body)
                        .source("system-alert-bridge")
                        .build())
                .build());
    }

    /**
     * Bridge: List<AttachmentNotificationDTO> → unified send with attachments.
     * Converts base64 attachments from old DTO format to new Recipient.attachments format.
     */
    public UnifiedSendResponse sendAttachmentEmailViaUnified(
            List<AttachmentNotificationDTO> dtos, String instituteId) {

        if (dtos == null || dtos.isEmpty()) {
            return UnifiedSendResponse.builder().total(0).accepted(0).failed(0).status("COMPLETED").build();
        }

        List<UnifiedSendRequest.Recipient> recipients = new java.util.ArrayList<>();

        for (AttachmentNotificationDTO dto : dtos) {
            if (dto.getUsers() == null) continue;

            for (vacademy.io.common.notification.dto.AttachmentUsersDTO user : dto.getUsers()) {
                List<UnifiedSendRequest.Attachment> attachments = new java.util.ArrayList<>();
                if (user.getAttachments() != null) {
                    for (vacademy.io.common.notification.dto.AttachmentUsersDTO.AttachmentDTO att : user.getAttachments()) {
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

        // Use first DTO for subject/body (all DTOs in a batch typically share the same template)
        AttachmentNotificationDTO first = dtos.get(0);
        String emailType = first.getEmailType() != null ? first.getEmailType() : "UTILITY_EMAIL";

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId != null ? instituteId : "")
                .channel("EMAIL")
                .recipients(recipients)
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(first.getSubject())
                        .emailBody(first.getBody())
                        .emailType(emailType)
                        .source(first.getSource())
                        .sourceId(first.getSourceId())
                        .build())
                .build());
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
