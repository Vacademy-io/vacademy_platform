
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
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PaymentNotificatonService {
    @Autowired
    private InstituteService instituteService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MediaService mediaService;


    public boolean sendPaymentConfirmationNotification(
        String instituteId,
        PaymentResponseDTO paymentResponseDTO,
        PaymentInitiationRequestDTO paymentInitiationRequestDTO,
        UserDTO userDTO) {
        if (instituteId == null || paymentResponseDTO == null || paymentInitiationRequestDTO == null || userDTO == null) {
            return false;
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null || userDTO.getEmail() == null) return false;

        if (!isPaymentSuccessful(paymentResponseDTO)) {
            return false;
        }

        // UPDATED: Build the email body using the new logic
        String emailBody = buildPaymentConfirmationEmailBody(institute, userDTO, paymentInitiationRequestDTO, paymentResponseDTO);
        if (emailBody == null) return false;

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(emailBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("Payment Confirmation from " + institute.getInstituteName());

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(userDTO.getId());
        notificationToUserDTO.setChannelId(paymentInitiationRequestDTO.getEmail() == null ? userDTO.getEmail() : paymentInitiationRequestDTO.getEmail());
        notificationToUserDTO.setPlaceholders(new HashMap<>());
        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO, instituteId);
        return true;
    }

    // This method can now be deprecated or removed if you only use Payment Intents
    public boolean sendDonationPaymentNotification(/*...*/) {
        // ... existing logic
        return true;
    }

    public boolean sendDonationPaymentConfirmationNotification(
        String instituteId,
        PaymentResponseDTO paymentResponseDTO,
        PaymentInitiationRequestDTO paymentInitiationRequestDTO,
        String email) {
        if (instituteId == null || paymentResponseDTO == null || paymentInitiationRequestDTO == null || email == null) {
            return false;
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null) return false;

        if (!isPaymentSuccessful(paymentResponseDTO)) {
            return false;
        }

        // UPDATED: Build the email body using the new logic
        String emailBody = buildDonationPaymentConfirmationEmailBody(institute, email, paymentInitiationRequestDTO, paymentResponseDTO);
        if (emailBody == null) return false;

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(emailBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("Donation Confirmation from " + institute.getInstituteName());

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(null); // No user ID for unknown users
        notificationToUserDTO.setPlaceholders(new HashMap<>());
        notificationToUserDTO.setChannelId(email);
        notificationDTO.setUsers(List.of(notificationToUserDTO));
        notificationService.sendEmailToUsers(notificationDTO, instituteId);
        return true;
    }

    /**
     * UPDATED: Builds email body using PaymentIntent data.
     */
    // In: vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService

    private String buildPaymentConfirmationEmailBody(
        Institute institute, UserDTO userDTO, PaymentInitiationRequestDTO requestDTO, PaymentResponseDTO responseDTO) {

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null) return null;

        String transactionId = safeCastToString(responseData.get("transactionId"));
        String instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());

        // This is the receipt URL you fetch from the Charge object
        String receiptUrl = safeCastToString(responseData.get("receiptUrl"));

        Number createdValue = (Number) responseData.getOrDefault("created", Instant.now().getEpochSecond());
        long createdTimestamp = createdValue.longValue();
        String paymentDate = Instant.ofEpochSecond(createdTimestamp)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
            .format(DateTimeFormatter.ofPattern("dd MMM yyyy"));


        String displayAmount = String.valueOf(responseDTO.getResponseData().get("amount"));

        // FIX: Pass the receiptUrl to the email body generator
        return StripeInvoiceEmailBody.getPaymentConfirmationEmailBody(
            safe(institute.getInstituteName()),
            safe(instituteLogoUrl),
            safe(userDTO.getFullName()),
            displayAmount,
            safe(requestDTO.getCurrency()),
            transactionId,
            paymentDate,
            receiptUrl,
            safe(institute.getAddress()),
            institute.getInstituteThemeCode()
        );
    }
    /**
     * UPDATED: Builds donation email body using PaymentIntent data.
     */
    private String buildDonationPaymentConfirmationEmailBody(
            Institute institute, String email, PaymentInitiationRequestDTO requestDTO, PaymentResponseDTO responseDTO) {

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null) return null;

        String transactionId = safeCastToString(responseData.get("transactionId"));
        String instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());
        String receiptUrl = safeCastToString(responseData.get("receiptUrl"));

        // FIX: Safely cast the 'created' timestamp to long
        Number createdValue = (Number) responseData.getOrDefault("created", Instant.now().getEpochSecond());
        long createdTimestamp = createdValue.longValue();

        String paymentDate = Instant.ofEpochSecond(createdTimestamp)
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
                .format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        // This line already uses the correct pattern
        String displayAmount = String.valueOf(responseDTO.getResponseData().get("amount"));

        return StripeInvoiceEmailBody.getPaymentConfirmationEmailBody(
                safe(institute.getInstituteName()),
                safe(instituteLogoUrl),
                "Supporter", // Generic greeting for donation
                displayAmount,
                safe(requestDTO.getCurrency()),
                transactionId,
                paymentDate,
                receiptUrl, // Corrected parameter order
                safe(institute.getAddress()),
                institute.getInstituteThemeCode()
        );
    }

    private boolean isPaymentSuccessful(PaymentResponseDTO responseDTO) {
        if (responseDTO == null || responseDTO.getResponseData() == null) return false;
        String paymentStatus = safeCastToString(responseDTO.getResponseData().get("paymentStatus"));
        return PaymentStatusEnum.PAID.name().equals(paymentStatus);
    }

    private String safeCastToString(Object value) {
        return value != null ? value.toString() : "";
    }
    private <T> T safe(T val) {
        // A simple way to avoid NullPointerException for strings in the template.
        if (val == null) return (T) "";
        return val;
    }
}
