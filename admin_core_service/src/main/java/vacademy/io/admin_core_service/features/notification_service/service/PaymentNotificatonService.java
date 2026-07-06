
package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.utils.StripeInvoiceEmailBody;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.logging.SentryLogger;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PaymentNotificatonService {
    @Autowired
    private InstituteService instituteService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    private BillingContactRecipientResolver billingContactRecipientResolver;

    @Autowired
    private InvoiceAdminCopyRecipientResolver invoiceAdminCopyRecipientResolver;

    public boolean sendPaymentConfirmationNotification(
            String instituteId,
            PaymentResponseDTO paymentResponseDTO,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            UserDTO userDTO) {
        return sendPaymentConfirmationNotification(instituteId, paymentResponseDTO,
                paymentInitiationRequestDTO, userDTO, null, null);
    }

    /**
     * Overload that can attach the invoice PDF directly to the payment-confirmation email.
     * Used when {@code INVOICE_SETTING.invoicePdfPlacement = PAYMENT_CONFIRMATION_EMAIL}, so the
     * learner receives a single mail (confirmation + invoice PDF) instead of two separate emails.
     * When {@code invoicePdfBytes} is null/empty this behaves exactly like the no-attachment path.
     */
    public boolean sendPaymentConfirmationNotification(
            String instituteId,
            PaymentResponseDTO paymentResponseDTO,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            UserDTO userDTO,
            byte[] invoicePdfBytes,
            String invoiceNumber) {
        if (instituteId == null || paymentResponseDTO == null || paymentInitiationRequestDTO == null
                || userDTO == null) {
            return false;
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null || userDTO.getEmail() == null)
            return false;

        if (!isPaymentSuccessful(paymentResponseDTO)) {
            return false;
        }

        // UPDATED: Build the email body using the new logic
        String emailBody = buildPaymentConfirmationEmailBody(institute, userDTO, paymentInitiationRequestDTO,
                paymentResponseDTO);
        if (emailBody == null)
            return false;

        String subject = "Payment Confirmation from " + institute.getInstituteName();
        String channelId = paymentInitiationRequestDTO.getEmail() == null ? userDTO.getEmail()
                : paymentInitiationRequestDTO.getEmail();
        boolean attachPdf = invoicePdfBytes != null && invoicePdfBytes.length > 0;

        try {
            if (attachPdf) {
                String attachmentName = "invoice_"
                        + (StringUtils.hasText(invoiceNumber) ? invoiceNumber : userDTO.getId()) + ".pdf";
                AttachmentUsersDTO.AttachmentDTO attachmentDTO = new AttachmentUsersDTO.AttachmentDTO();
                attachmentDTO.setAttachmentName(attachmentName);
                attachmentDTO.setAttachment(Base64.getEncoder().encodeToString(invoicePdfBytes));

                AttachmentUsersDTO toUser = new AttachmentUsersDTO();
                toUser.setUserId(userDTO.getId());
                toUser.setChannelId(channelId);
                toUser.setPlaceholders(new HashMap<>());
                toUser.setAttachments(List.of(attachmentDTO));

                List<AttachmentUsersDTO> recipients = new ArrayList<>();
                recipients.add(toUser);
                billingContactRecipientResolver
                        .buildBillingContactAttachmentRecipient(userDTO.getId(), instituteId, channelId,
                                List.of(attachmentDTO))
                        .ifPresent(recipients::add);
                recipients.addAll(invoiceAdminCopyRecipientResolver.buildAdminCopyAttachmentRecipients(
                        instituteId,
                        recipients.stream().map(AttachmentUsersDTO::getChannelId).collect(Collectors.toSet()),
                        List.of(attachmentDTO)));

                AttachmentNotificationDTO attachmentNotification = AttachmentNotificationDTO.builder()
                        .body(emailBody)
                        .subject(subject)
                        .notificationType(CommunicationType.EMAIL.name())
                        .source("PAYMENT_CONFIRMATION")
                        .sourceId(StringUtils.hasText(invoiceNumber) ? invoiceNumber : userDTO.getId())
                        .users(recipients)
                        .build();

                notificationService.sendAttachmentEmailViaUnified(List.of(attachmentNotification), instituteId);
            } else {
                NotificationDTO notificationDTO = new NotificationDTO();
                notificationDTO.setBody(emailBody);
                notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
                notificationDTO.setSubject(subject);

                NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
                notificationToUserDTO.setUserId(userDTO.getId());
                notificationToUserDTO.setChannelId(channelId);
                notificationToUserDTO.setPlaceholders(new HashMap<>());

                List<NotificationToUserDTO> recipients = new ArrayList<>();
                recipients.add(notificationToUserDTO);
                billingContactRecipientResolver
                        .buildBillingContactRecipient(userDTO.getId(), instituteId, channelId)
                        .ifPresent(recipients::add);
                recipients.addAll(invoiceAdminCopyRecipientResolver.buildAdminCopyRecipients(
                        instituteId,
                        recipients.stream().map(NotificationToUserDTO::getChannelId).collect(Collectors.toSet())));
                notificationDTO.setUsers(recipients);

                notificationService.sendEmailViaUnified(notificationDTO, instituteId);
            }
            return true;
        } catch (Exception e) {
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send payment confirmation email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "PAYMENT_CONFIRMATION")
                    .withTag("institute.id", instituteId)
                    .withTag("user.id", userDTO.getId())
                    .withTag("user.email", channelId)
                    .withTag("operation", "sendPaymentConfirmationEmail")
                    .send();
            return false;
        }
    }

    // This method can now be deprecated or removed if you only use Payment Intents
    public boolean sendDonationPaymentNotification(/* ... */) {
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
        if (institute == null)
            return false;

        if (!isPaymentSuccessful(paymentResponseDTO)) {
            return false;
        }

        // UPDATED: Build the email body using the new logic
        String emailBody = buildDonationPaymentConfirmationEmailBody(institute, email, paymentInitiationRequestDTO,
                paymentResponseDTO);
        if (emailBody == null)
            return false;

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(emailBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("Donation Confirmation from " + institute.getInstituteName());

        NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
        notificationToUserDTO.setUserId(null); // No user ID for unknown users
        notificationToUserDTO.setPlaceholders(new HashMap<>());
        notificationToUserDTO.setChannelId(email);
        notificationDTO.setUsers(List.of(notificationToUserDTO));

        try {
            notificationService.sendEmailViaUnified(notificationDTO, instituteId);
            return true;
        } catch (Exception e) {
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send donation payment confirmation email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "DONATION_CONFIRMATION")
                    .withTag("institute.id", instituteId)
                    .withTag("donor.email", email)
                    .withTag("payment.amount", String.valueOf(paymentInitiationRequestDTO.getAmount()))
                    .withTag("operation", "sendDonationConfirmationEmail")
                    .send();
            return false;
        }
    }

    /**
     * UPDATED: Builds email body using PaymentIntent data.
     */
    // In:
    // vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService

    private String buildPaymentConfirmationEmailBody(
            Institute institute, UserDTO userDTO, PaymentInitiationRequestDTO requestDTO,
            PaymentResponseDTO responseDTO) {

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null)
            return null;

        String transactionId = safeCastToString(responseData.get("transactionId"));
        String instituteLogoUrl = "";
        try {
            if (StringUtils.hasText(institute.getLogoFileId())) {
                instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());
            }
        } catch (Exception e) {
            // Log and continue without logo
            SentryLogger.logError(e, "Failed to get institute logo for email",
                    Map.of("instituteId", institute.getId()));
        }

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
                institute.getInstituteThemeCode());
    }

    /**
     * UPDATED: Builds donation email body using PaymentIntent data.
     */
    private String buildDonationPaymentConfirmationEmailBody(
            Institute institute, String email, PaymentInitiationRequestDTO requestDTO, PaymentResponseDTO responseDTO) {

        Map<String, Object> responseData = responseDTO.getResponseData();
        if (responseData == null)
            return null;

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
                institute.getInstituteThemeCode());
    }

    private boolean isPaymentSuccessful(PaymentResponseDTO responseDTO) {
        if (responseDTO == null || responseDTO.getResponseData() == null)
            return false;
        String paymentStatus = safeCastToString(responseDTO.getResponseData().get("paymentStatus"));
        return PaymentStatusEnum.PAID.name().equals(paymentStatus);
    }

    private String safeCastToString(Object value) {
        return value != null ? value.toString() : "";
    }

    private <T> T safe(T val) {
        // A simple way to avoid NullPointerException for strings in the template.
        if (val == null)
            return (T) "";
        return val;
    }

    // ========================================================================
    // AI Credit Pack confirmation email (v1: basic HTML body, no PDF attachment)
    // ========================================================================

    /**
     * Send a confirmation email after a successful AI credit pack purchase.
     * Called from {@code PlatformRazorpayWebHookService.handleCreditPackPayment}
     * once the credits have been granted and the {@code platform_invoice} row
     * persisted.
     *
     * v1 scope: minimal HTML body, no PDF attachment. v1.1 will attach the
     * rendered invoice PDF once {@code PlatformInvoiceService} populates
     * {@code platform_invoice.pdf_s3_url}.
     *
     * @param instituteId      buyer institute (for tenant routing in unified)
     * @param recipientEmail   email to deliver to (buyer's clicker email)
     * @param recipientUserId  user id of the recipient (for placeholders)
     * @param invoiceNumber    e.g. "INV-AICRED-202605-0001"
     * @param creditsGranted   credits added to the institute's balance
     * @param totalAmountMajor "₹548.70" / "$25.00"
     * @param packName         e.g. "Pro"
     * @return true on success, false on any failure (Sentry-logged)
     */
    public boolean sendCreditPackConfirmation(
            String instituteId,
            String recipientEmail,
            String recipientUserId,
            String invoiceNumber,
            String creditsGranted,
            String totalAmountMajor,
            String packName) {
        if (instituteId == null || recipientEmail == null || invoiceNumber == null) {
            return false;
        }

        Institute institute = instituteService.findById(instituteId);
        if (institute == null) {
            return false;
        }

        String body = buildCreditPackEmailBody(
                institute.getInstituteName(), invoiceNumber, creditsGranted, totalAmountMajor, packName);

        NotificationDTO notification = new NotificationDTO();
        notification.setBody(body);
        notification.setNotificationType(CommunicationType.EMAIL.name());
        notification.setSubject("Your AI credits are ready — invoice " + invoiceNumber);

        NotificationToUserDTO recipient = new NotificationToUserDTO();
        recipient.setUserId(recipientUserId);
        recipient.setChannelId(recipientEmail);
        recipient.setPlaceholders(new HashMap<>());
        notification.setUsers(List.of(recipient));

        try {
            notificationService.sendEmailViaUnified(notification, instituteId);
            return true;
        } catch (Exception e) {
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send AI credit pack confirmation email")
                    .withTag("notification.type", "EMAIL")
                    .withTag("email.type", "AI_CREDIT_PACK_CONFIRMATION")
                    .withTag("institute.id", instituteId)
                    .withTag("user.id", recipientUserId == null ? "anonymous" : recipientUserId)
                    .withTag("user.email", recipientEmail)
                    .withTag("invoice.number", invoiceNumber)
                    .withTag("operation", "sendCreditPackConfirmation")
                    .send();
            return false;
        }
    }

    private static String buildCreditPackEmailBody(
            String instituteName, String invoiceNumber, String credits, String total, String packName) {
        String safeInstitute = StringUtils.hasText(instituteName) ? instituteName : "your institute";
        String safePack = StringUtils.hasText(packName) ? packName : "AI Credits";
        return "<!DOCTYPE html><html><body style=\"font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;\">"
                + "<div style=\"max-width:560px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;\">"
                + "<h2 style=\"margin:0 0 16px;color:#7c3aed;\">Payment received</h2>"
                + "<p>Thanks — your <strong>" + safePack + "</strong> purchase for <strong>" + safeInstitute
                + "</strong> went through.</p>"
                + "<table style=\"width:100%;border-collapse:collapse;margin:16px 0;\">"
                + "<tr><td style=\"padding:6px 0;color:#6b7280;\">Credits added</td>"
                + "<td style=\"padding:6px 0;text-align:right;font-weight:600;\">" + credits + "</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#6b7280;\">Amount paid</td>"
                + "<td style=\"padding:6px 0;text-align:right;font-weight:600;\">" + total + "</td></tr>"
                + "<tr><td style=\"padding:6px 0;color:#6b7280;\">Invoice number</td>"
                + "<td style=\"padding:6px 0;text-align:right;font-family:ui-monospace,monospace;font-size:13px;\">"
                + invoiceNumber + "</td></tr>"
                + "</table>"
                + "<p style=\"color:#6b7280;font-size:13px;margin-top:24px;\">"
                + "Your credits are already available in the AI Credits panel. "
                + "A GST-compliant invoice will be available for download from your billing dashboard shortly.</p>"
                + "</div></body></html>";
    }
}
