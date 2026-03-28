package vacademy.io.auth_service.feature.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.notification.constants.NotificationConstant;
import vacademy.io.auth_service.feature.notification.dto.NotificationDTO;
import vacademy.io.auth_service.feature.auth.dto.NotificationTemplateConfigDTO;
import vacademy.io.auth_service.feature.auth.dto.WhatsAppOTPRequest;
import vacademy.io.auth_service.feature.auth.dto.WhatsAppOTPVerifyRequest;
import vacademy.io.auth_service.feature.notification.dto.unified.UnifiedSendRequest;
import vacademy.io.auth_service.feature.notification.dto.unified.UnifiedSendResponse;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.EmailOTPRequest;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;

@Service
public class NotificationService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${notification.server.baseurl}")
    private String notificationServerBaseUrl;

    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;

    public NotificationTemplateConfigDTO getTemplateConfig(
            String eventName, String instituteId, String templateType) {

        String url = "/admin-core-service/internal/v1/notification-config/by-event" +
                "?event_name=" + eventName +
                "&institute_id=" + instituteId +
                "&template_type=" + templateType;

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                adminCoreServiceBaseUrl,
                url,
                null);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            return objectMapper.readValue(response.getBody(),
                    new TypeReference<NotificationTemplateConfigDTO>() {
                    });
        } catch (JsonProcessingException e) {
            throw new VacademyException("Failed to parse template config: " + e.getMessage());
        }
    }

    public String sendOtp(EmailOTPRequest emailOTPRequest, String instituteId) {
        // Removed the redundant 'clientName' parameter, we can use the injected
        // clientName field here
        instituteId = instituteId != null ? instituteId : "";
        String url = NotificationConstant.SEND_EMAIL_OTP + "?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                url,
                emailOTPRequest);
        return response.getBody();
    }

    public Boolean verifyOTP(EmailOTPRequest request) {

        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(clientName, HttpMethod.POST.name(),
                notificationServerBaseUrl, NotificationConstant.VERIFY_EMAIL_OTP, request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isOtpValid = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });

            return isOtpValid;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    // Old methods (sendGenericHtmlMail, sendEmailToUsers) removed — replaced by bridge methods below

    public String sendWhatsAppOtp(WhatsAppOTPRequest whatsAppOTPRequest) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.SEND_WHATSAPP_OTP,
                whatsAppOTPRequest);
        return response.getBody();
    }

    public Boolean verifyWhatsAppOTP(WhatsAppOTPVerifyRequest request) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.VERIFY_WHATSAPP_OTP,
                request);

        ObjectMapper objectMapper = new ObjectMapper();
        try {
            Boolean isOtpValid = objectMapper.readValue(response.getBody(), new TypeReference<Boolean>() {
            });
            return isOtpValid;
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    // ==================== Unified Send Bridge ====================

    public UnifiedSendResponse sendUnified(UnifiedSendRequest request) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, HttpMethod.POST.name(),
                notificationServerBaseUrl,
                NotificationConstant.UNIFIED_SEND,
                request);

        ObjectMapper mapper = new ObjectMapper();
        try {
            return mapper.readValue(response.getBody(), UnifiedSendResponse.class);
        } catch (JsonProcessingException e) {
            throw new VacademyException("Error parsing unified send response: " + e.getMessage());
        }
    }

    /**
     * Bridge: GenericEmailRequest → unified send.
     * Returns UnifiedSendResponse but callers that check Boolean can use isSuccess().
     */
    public UnifiedSendResponse sendGenericHtmlMailViaUnified(GenericEmailRequest request, String instituteId) {
        String emailType = request.getEmailType() != null ? request.getEmailType() : "UTILITY_EMAIL";

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId != null ? instituteId : "")
                .channel("EMAIL")
                .recipients(List.of(UnifiedSendRequest.Recipient.builder()
                        .email(request.getTo()).build()))
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(request.getSubject())
                        .emailBody(request.getBody())
                        .emailType(emailType)
                        .source("auth-service")
                        .build())
                .build());
    }

    /**
     * Bridge: GenericEmailRequest → unified send, returns Boolean for callers that check result.
     */
    public Boolean sendGenericHtmlMailViaUnifiedAsBoolean(GenericEmailRequest request, String instituteId) {
        try {
            UnifiedSendResponse response = sendGenericHtmlMailViaUnified(request, instituteId);
            return response != null && response.getAccepted() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Bridge: NotificationDTO → unified send.
     */
    public UnifiedSendResponse sendEmailViaUnified(NotificationDTO dto, String instituteId) {
        java.util.List<UnifiedSendRequest.Recipient> recipients = new java.util.ArrayList<>();
        if (dto.getUsers() != null) {
            for (var user : dto.getUsers()) {
                recipients.add(UnifiedSendRequest.Recipient.builder()
                        .email(user.getChannelId())
                        .userId(user.getUserId())
                        .variables(user.getPlaceholders())
                        .build());
            }
        }

        return sendUnified(UnifiedSendRequest.builder()
                .instituteId(instituteId != null ? instituteId : "")
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
}
