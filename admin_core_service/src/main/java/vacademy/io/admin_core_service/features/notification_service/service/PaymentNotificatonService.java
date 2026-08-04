
package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.service.DynamicNotificationService;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.utils.StripeInvoiceEmailBody;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.common.payment.enums.PaymentStatusEnum;
import vacademy.io.common.logging.SentryLogger;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class PaymentNotificatonService {

    /** Locale-pinned so month names read identically regardless of the host JVM locale. */
    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    @Autowired
    private InstituteService instituteService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    private DynamicNotificationService dynamicNotificationService;

    @Autowired
    private SendUniqueLinkService sendUniqueLinkService;

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
                paymentInitiationRequestDTO, userDTO, null, null, null, null);
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
        return sendPaymentConfirmationNotification(instituteId, paymentResponseDTO,
                paymentInitiationRequestDTO, userDTO, invoicePdfBytes, invoiceNumber, null, null);
    }

    /**
     * Full overload. The body comes from whichever template the {@code PAYMENT_CONFIRMATION}
     * event config points at for this institute (falling back to the seeded {@code DEFAULT}
     * config), so an institute changes its confirmation mail by editing a template — no code.
     *
     * <p>{@code paymentLog} is the authoritative source for the money facts. The gateway
     * {@code responseData} cannot be trusted for them: on the live Razorpay webhook path it
     * carries only {@code {"paymentStatus":"PAID"}}, and where it does carry an amount it is in
     * minor units (500000 for ₹5,000). {@code courseName} is resolved by the caller, which holds
     * the InvoiceService that already derives it for the invoice line item.
     *
     * <p>Delivery stays here rather than going through
     * {@code DynamicNotificationService.sendNotificationViaUnifiedApi} because this mail also
     * carries the invoice PDF and copies the billing contact plus any admin-copy recipients,
     * which that single-recipient helper does not model.
     */
    public boolean sendPaymentConfirmationNotification(
            String instituteId,
            PaymentResponseDTO paymentResponseDTO,
            PaymentInitiationRequestDTO paymentInitiationRequestDTO,
            UserDTO userDTO,
            byte[] invoicePdfBytes,
            String invoiceNumber,
            String courseName,
            PaymentLog paymentLog) {
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

        Template template = resolvePaymentConfirmationTemplate(instituteId);
        if (template == null || !StringUtils.hasText(template.getContent())) {
            SentryLogger.logError(
                    new IllegalStateException("No PAYMENT_CONFIRMATION email template resolved"),
                    "Payment confirmation email skipped - no institute or DEFAULT config/template",
                    Map.of("instituteId", instituteId, "userId", safe(userDTO.getId())));
            return false;
        }

        // Variables come from the declared NotificationTemplateVariables fields, mapped by
        // SendUniqueLinkService: it emits both {{camelCase}} and {{snake_case}} for every field
        // and overlays the template's own dynamic_parameters for anything left blank.
        NotificationTemplateVariables templateVars = buildPaymentConfirmationVariables(
                institute, userDTO, paymentInitiationRequestDTO, paymentResponseDTO,
                invoiceNumber, courseName, paymentLog, invoicePdfBytes);
        Map<String, String> variables = sendUniqueLinkService.buildVariablesMap(template, templateVars);

        String emailBody = applyVariables(template.getContent(), variables);
        String subject = StringUtils.hasText(template.getSubject())
                ? applyVariables(template.getSubject(), variables)
                : "Payment Confirmation from " + institute.getInstituteName();

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
     * Template bound to the PAYMENT_CONFIRMATION event for this institute, falling back to the
     * platform-wide DEFAULT config seeded in V421. Returns null when neither resolves.
     */
    private Template resolvePaymentConfirmationTemplate(String instituteId) {
        try {
            Optional<NotificationEventConfig> config = dynamicNotificationService.findEventConfig(
                    NotificationEventType.PAYMENT_CONFIRMATION, instituteId, NotificationTemplateType.EMAIL);
            return config.map(c -> dynamicNotificationService.resolveTemplate(c, instituteId)).orElse(null);
        } catch (Exception e) {
            SentryLogger.logError(e, "Failed to resolve payment confirmation template",
                    Map.of("instituteId", instituteId));
            return null;
        }
    }

    /**
     * Populates the declared payment-confirmation variable fields.
     *
     * <p>Nothing here invents placeholder names — the field names on
     * {@link NotificationTemplateVariables} are the contract, and SendUniqueLinkService derives
     * the {@code {{snake_case}}} keys from them.
     */
    private NotificationTemplateVariables buildPaymentConfirmationVariables(
            Institute institute, UserDTO userDTO, PaymentInitiationRequestDTO requestDTO,
            PaymentResponseDTO responseDTO, String invoiceNumber, String courseName,
            PaymentLog paymentLog, byte[] invoicePdfBytes) {

        Map<String, Object> responseData = responseDTO.getResponseData() != null
                ? responseDTO.getResponseData()
                : Map.of();

        String learnerName = StringUtils.hasText(userDTO.getFullName())
                ? userDTO.getFullName()
                : safe(userDTO.getEmail());

        // PaymentLog carries the amount in major units; responseData carries minor units when it
        // carries anything, so it is never used as a numeric source.
        Double amountValue = paymentLog != null ? paymentLog.getPaymentAmount() : null;
        if (amountValue == null) {
            amountValue = requestDTO.getAmount();
        }
        String amount = amountValue != null ? String.format(Locale.ENGLISH, "%,.2f", amountValue) : "";

        String currency = StringUtils.hasText(requestDTO.getCurrency())
                ? requestDTO.getCurrency()
                : (paymentLog != null ? safe(paymentLog.getCurrency()) : "");

        // created_at, not the `date` DATE column — the latter loses the time of day.
        String paymentDate;
        if (paymentLog != null && paymentLog.getCreatedAt() != null) {
            paymentDate = paymentLog.getCreatedAt().format(DATE_FORMAT);
        } else {
            Number createdValue = responseData.get("created") instanceof Number
                    ? (Number) responseData.get("created")
                    : Instant.now().getEpochSecond();
            paymentDate = Instant.ofEpochSecond(createdValue.longValue())
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate()
                    .format(DATE_FORMAT);
        }

        // Gateway reference when the response carried one, else our payment-log id — which is the
        // order_id the gateway was handed, so it stays traceable either way.
        String transactionId = safeCastToString(responseData.get("transactionId"));
        if (!StringUtils.hasText(transactionId) && paymentLog != null) {
            transactionId = safe(paymentLog.getId());
        }

        String receiptUrl = safeCastToString(responseData.get("receiptUrl"));
        boolean pdfAttached = invoicePdfBytes != null && invoicePdfBytes.length > 0;
        String instituteLogoUrl = resolveInstituteLogoUrl(institute);

        return NotificationTemplateVariables.builder()
                .userId(userDTO.getId())
                .userEmail(safe(userDTO.getEmail()))
                .userMobile(safe(userDTO.getMobileNumber()))
                .userFullName(learnerName)
                .name(learnerName)
                .learnerName(learnerName)
                .courseName(safe(courseName))
                .packageName(safe(courseName))
                .amount(amount)
                .paymentAmount(amount)
                .paymentStatus(PaymentStatusEnum.PAID.name())
                .currency(currency)
                .currencySymbol(currencySymbol(currency))
                .paymentDate(paymentDate)
                .paymentMode(paymentLog != null && StringUtils.hasText(paymentLog.getVendor())
                        ? paymentLog.getVendor()
                        : safe(requestDTO.getVendor()))
                .transactionId(transactionId)
                .invoiceNumber(safe(invoiceNumber))
                .receiptUrl(receiptUrl)
                .invoicePdfLink(pdfAttached
                        ? "Please find your invoice attached to this email."
                        : receiptUrl)
                .instituteId(institute.getId())
                .instituteName(safe(institute.getInstituteName()))
                .instituteAddress(safe(institute.getAddress()))
                .instituteContact(StringUtils.hasText(institute.getMobileNumber())
                        ? institute.getMobileNumber()
                        : safe(institute.getEmail()))
                .instituteEmail(safe(institute.getEmail()))
                .instituteWebsite(safe(institute.getWebsiteUrl()))
                .instituteLogoUrl(instituteLogoUrl)
                .instituteLogo(StringUtils.hasText(instituteLogoUrl)
                        ? "<img src=\"" + instituteLogoUrl + "\" alt=\"" + safe(institute.getInstituteName())
                                + "\" style=\"max-height:60px;\" />"
                        : "")
                // Same name->hex mapping the built-in body used, so the seeded DEFAULT template
                // renders in the institute's colour exactly as before.
                .themeColor(StripeInvoiceEmailBody.getThemeColorHex(institute.getInstituteThemeCode()))
                .receiptButton(StringUtils.hasText(receiptUrl)
                        ? "<table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\""
                                + " style=\"margin: 30px 0;\"><tr><td align=\"center\">"
                                + "<a href=\"" + receiptUrl + "\" class=\"cta-button\">View Full Receipt</a>"
                                + "</td></tr></table>"
                        : "")
                .currentDate(LocalDateTime.now().format(DATE_FORMAT))
                .year(String.valueOf(LocalDateTime.now().getYear()))
                .build();
    }

    /**
     * Literal {@code {{key}}} substitution, matching UnifiedSendService's own replacement so a
     * template renders identically whichever path sends it. Applied to the shared body rather
     * than per-recipient placeholders because the billing-contact and admin-copy recipients are
     * built with empty placeholder maps — per-recipient substitution would leave their copies
     * showing raw tokens. Unknown tokens are left intact so an authoring typo stays visible.
     */
    private String applyVariables(String content, Map<String, String> variables) {
        if (!StringUtils.hasText(content)) {
            return content;
        }
        String filled = content;
        for (Map.Entry<String, String> var : variables.entrySet()) {
            filled = filled.replace("{{" + var.getKey() + "}}", var.getValue() != null ? var.getValue() : "");
        }
        return filled;
    }

    private String resolveInstituteLogoUrl(Institute institute) {
        try {
            if (StringUtils.hasText(institute.getLogoFileId())) {
                return safe(mediaService.getFileUrlById(institute.getLogoFileId()));
            }
        } catch (Exception e) {
            SentryLogger.logError(e, "Failed to get institute logo for email",
                    Map.of("instituteId", institute.getId()));
        }
        return "";
    }

    private String currencySymbol(String currency) {
        if (!StringUtils.hasText(currency)) {
            return "";
        }
        switch (currency.toUpperCase()) {
            case "INR":
                return "₹";
            case "USD":
                return "$";
            case "EUR":
                return "€";
            case "GBP":
                return "£";
            case "AUD":
                return "A$";
            case "AED":
                return "د.إ";
            default:
                return currency.toUpperCase();
        }
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
