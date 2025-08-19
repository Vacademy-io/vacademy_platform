package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.utils.StripeInvoiceEmailBody;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class PaymentNotificatonService {
    @Autowired
    private InstituteService instituteService;

    @Autowired
    private EmailNotificationService notificationService;

    @Autowired
    private MediaService mediaService;

    public boolean sendPaymentNotification(
            String instituteId,
            PaymentResponseDTO paymentResponseDTO,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            UserDTO userDTO,
            String paymentGateway
    ) {
        if (instituteId == null || paymentResponseDTO == null || paymentInitiationRequestDTO == null || userDTO == null) {
            return false; // Invalid input
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null || userDTO.getEmail() == null) return false;

        String emailBody = buildInvoiceEmailBody(institute, userDTO, paymentInitiationRequestDTO, paymentResponseDTO);
        if (emailBody == null) return false;

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(emailBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("Invoice Created");

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(userDTO.getId());
        notificationToUserDTO.setChannelId(userDTO.getEmail());
        notificationToUserDTO.setPlaceholders(Map.of());
        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO,instituteId);
        return true;
    }

    public boolean sendPaymentConfirmationNotification(
            String instituteId,
            PaymentResponseDTO paymentResponseDTO,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            UserDTO userDTO
    ) {
        if (instituteId == null || paymentResponseDTO == null || paymentInitiationRequestDTO == null || userDTO == null) {
            return false; // Invalid input
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null || userDTO.getEmail() == null) return false;

        // Build the email body using the payment confirmation template
        String emailBody = buildPaymentConfirmationEmailBody(institute, userDTO, paymentInitiationRequestDTO, paymentResponseDTO);
        if (emailBody == null) return false;

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(emailBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("Payment Confirmation from " + institute.getInstituteName());

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(userDTO.getId());
        notificationToUserDTO.setChannelId(userDTO.getEmail());
        notificationToUserDTO.setPlaceholders(Map.of());
        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO,instituteId);
        return true;
    }


    private String buildInvoiceEmailBody(
            Institute institute,
            UserDTO userDTO,
            PaymentInitiationRequestDTO requestDTO,
            PaymentResponseDTO responseDTO
    ) {
        if (institute == null || requestDTO == null || responseDTO == null || userDTO == null) return null;

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null) return null;

        String invoiceId = safeCastToString(responseData.get("invoiceId"));
        String dueDate = safeCastToString(responseData.get("dueDate"));
        String paymentUrl = safeCastToString(responseData.get("paymentUrl"));
        String invoicePdfUrl = safeCastToString(responseData.get("invoicePdfUrl"));
        String instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());

        return StripeInvoiceEmailBody.getInvoiceCreatedEmailBody(
                safe(institute.getInstituteName()),
                safe(instituteLogoUrl),
                safe(userDTO.getFullName()),
                safe(requestDTO.getAmount()).toString(),
                safe(requestDTO.getCurrency()),
                invoiceId,
                dueDate,
                paymentUrl,
                invoicePdfUrl,
                safe(institute.getAddress()),
                institute.getInstituteThemeCode()
        );
    }
    /**
     * Builds the HTML for the payment confirmation email.
     */
    private String buildPaymentConfirmationEmailBody(
            Institute institute,
            UserDTO userDTO,
            PaymentInitiationRequestDTO requestDTO,
            PaymentResponseDTO responseDTO
    ) {
        if (institute == null || requestDTO == null || responseDTO == null || userDTO == null) return null;

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null) return null;

        // Extract data needed for the confirmation email
        String invoiceId = safeCastToString(responseData.get("invoiceId"));
        String receiptPdfUrl = safeCastToString(responseData.get("receiptPdfUrl"));
        String instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());

        // Default to today's date if not provided in the response
        String paymentDate = responseData.containsKey("paymentDate") ?
                safeCastToString(responseData.get("paymentDate")) :
                LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        // Call the static method from your EmailTemplates class
        return StripeInvoiceEmailBody.getPaymentConfirmationEmailBody(
                safe(institute.getInstituteName()),
                safe(instituteLogoUrl),
                safe(userDTO.getFullName()),
                safe(requestDTO.getAmount()).toString(),
                safe(requestDTO.getCurrency()),
                invoiceId,
                paymentDate,
                receiptPdfUrl,
                safe(institute.getAddress()),
                institute.getInstituteThemeCode()
        );
    }

    private String safeCastToString(Object value) {
        return value != null ? value.toString() : "";
    }

    private <T> T safe(T val) {
        return val != null ? val : (T) "";
    }


}
