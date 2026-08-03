
package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class PaymentNotificatonService {

    /**
     * Template type an institute uses to override the built-in payment-confirmation mail.
     * A template of this type wins over {@link StripeInvoiceEmailBody}; the hardcoded body is
     * only the fallback for institutes that have not authored one.
     */
    private static final String PAYMENT_CONFIRMATION_TEMPLATE_TYPE = "PAYMENT_CONFIRMATION";

    /** Locale-pinned so month names read the same regardless of the host JVM locale. */
    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    /**
     * Legacy/name-based escape hatch, mirroring how {@code InvoiceService} falls back to an
     * EMAIL template literally named "Invoice Email". Lets an institute wire the override from
     * the plain email editor before the typed option is rolled out to them.
     */
    private static final String PAYMENT_CONFIRMATION_TEMPLATE_NAME = "Payment_confirmation";

    /** Statuses that take a template out of service; null/blank status counts as usable. */
    private static final List<String> UNUSABLE_TEMPLATE_STATUSES = List.of("DELETED", "INACTIVE", "DRAFT");

    @Autowired
    private InstituteService instituteService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    private TemplateRepository templateRepository;

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
        return sendPaymentConfirmationNotification(instituteId, paymentResponseDTO,
                paymentInitiationRequestDTO, userDTO, invoicePdfBytes, invoiceNumber, null, null);
    }

    /**
     * Full overload used by the template path.
     *
     * <p>{@code paymentLog} is the authoritative source for the money facts. The gateway
     * {@code responseData} cannot be trusted for them: on the live Razorpay webhook path it
     * carries only {@code {"paymentStatus":"PAID"}} (no amount, no transactionId), and where it
     * DOES carry an amount it is in minor units (500000 for ₹5,000). Reading those straight into
     * a template renders a blank or 100×-inflated amount, so PaymentLog wins wherever it has a
     * value. {@code courseName} is resolved by the caller via InvoiceService.
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

        // An institute-authored template replaces the built-in body entirely — subject included,
        // so the mail reads in the institute's own voice rather than "Payment Confirmation from X".
        Optional<Template> instituteTemplate = resolvePaymentConfirmationTemplate(instituteId);
        String subject = "Payment Confirmation from " + institute.getInstituteName();
        String emailBody;

        if (instituteTemplate.isPresent()) {
            Template template = instituteTemplate.get();
            Map<String, String> placeholders = buildPaymentConfirmationPlaceholders(
                    institute, userDTO, paymentInitiationRequestDTO, paymentResponseDTO,
                    invoiceNumber, courseName, paymentLog, invoicePdfBytes);
            emailBody = applyPlaceholders(template.getContent(), placeholders);
            if (StringUtils.hasText(template.getSubject())) {
                subject = applyPlaceholders(template.getSubject(), placeholders);
            }
        } else {
            emailBody = buildPaymentConfirmationEmailBody(institute, userDTO, paymentInitiationRequestDTO,
                    paymentResponseDTO);
        }

        if (!StringUtils.hasText(emailBody))
            return false;

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
     * Find the institute's own payment-confirmation email, if it has authored one.
     *
     * <p>Resolution order: a template typed {@link #PAYMENT_CONFIRMATION_TEMPLATE_TYPE} (newest
     * first, matching how the invoice email picks its template), then an EMAIL template named
     * {@link #PAYMENT_CONFIRMATION_TEMPLATE_NAME}. Empty means "no override" and the caller
     * falls back to the built-in body — so an institute that never creates one is unaffected.
     */
    private Optional<Template> resolvePaymentConfirmationTemplate(String instituteId) {
        try {
            Optional<Template> typed = newestUsable(
                    templateRepository.findByInstituteIdAndType(instituteId, PAYMENT_CONFIRMATION_TEMPLATE_TYPE));
            if (typed.isPresent()) {
                return typed;
            }
            return newestUsable(templateRepository.findByInstituteIdAndNameAndTypeIgnoreCase(
                    instituteId, PAYMENT_CONFIRMATION_TEMPLATE_NAME, "EMAIL"));
        } catch (Exception e) {
            // Never let template lookup cost the learner their confirmation mail.
            SentryLogger.logError(e, "Failed to resolve payment confirmation template",
                    Map.of("instituteId", instituteId));
            return Optional.empty();
        }
    }

    /** Newest non-retired template from a candidate list; templates with no status count as live. */
    private Optional<Template> newestUsable(List<Template> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return Optional.empty();
        }
        return candidates.stream()
                .filter(t -> t != null && StringUtils.hasText(t.getContent()))
                .filter(t -> !StringUtils.hasText(t.getStatus())
                        || !UNUSABLE_TEMPLATE_STATUSES.contains(t.getStatus().toUpperCase()))
                .max(Comparator.comparing(Template::getCreatedAt,
                        Comparator.nullsFirst(Comparator.<LocalDateTime>naturalOrder())));
    }

    /**
     * Every placeholder an institute payment-confirmation template may use. Names follow the
     * snake_case convention the rest of the template system uses, and aliases are supplied where
     * two names are already in circulation ({@code learner_name}/{@code user_name},
     * {@code amount}/{@code total_amount}) so a template copied from the invoice email still fills.
     */
    private Map<String, String> buildPaymentConfirmationPlaceholders(
            Institute institute, UserDTO userDTO, PaymentInitiationRequestDTO requestDTO,
            PaymentResponseDTO responseDTO, String invoiceNumber, String courseName,
            PaymentLog paymentLog, byte[] invoicePdfBytes) {

        Map<String, Object> responseData = responseDTO.getResponseData() != null
                ? responseDTO.getResponseData()
                : Map.of();

        String learnerName = StringUtils.hasText(userDTO.getFullName()) ? userDTO.getFullName() : safe(userDTO.getEmail());
        String receiptUrl = safeCastToString(responseData.get("receiptUrl"));
        boolean pdfAttached = invoicePdfBytes != null && invoicePdfBytes.length > 0;

        // Amount: PaymentLog holds it in major units (₹329). responseData holds minor units when
        // it holds anything at all, so it is never used as a numeric source here — only the
        // initiation request's major-unit amount serves as a fallback.
        Double amountValue = paymentLog != null ? paymentLog.getPaymentAmount() : null;
        if (amountValue == null) {
            amountValue = requestDTO.getAmount();
        }
        // Locale-pinned: the default JVM locale would render "2.600,00" on a de_DE host.
        String amount = amountValue != null ? String.format(Locale.ENGLISH, "%,.2f", amountValue) : "";

        String currency = StringUtils.hasText(requestDTO.getCurrency())
                ? requestDTO.getCurrency()
                : (paymentLog != null ? safe(paymentLog.getCurrency()) : "");

        // Date: created_at, not the `date` DATE column — the latter loses the time of day.
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

        // Transaction reference: the gateway id when the response carried one, else our own
        // payment-log id — which is the order_id the gateway was handed, so it is still traceable.
        String transactionId = safeCastToString(responseData.get("transactionId"));
        if (!StringUtils.hasText(transactionId) && paymentLog != null) {
            transactionId = safe(paymentLog.getId());
        }

        String resolvedMethod = paymentLog != null && StringUtils.hasText(paymentLog.getVendor())
                ? paymentLog.getVendor()
                : safe(requestDTO.getVendor());
        String instituteLogoUrl = resolveInstituteLogoUrl(institute);

        Map<String, String> vars = new HashMap<>();
        // Learner
        vars.put("learner_name", learnerName);
        vars.put("user_name", learnerName);
        vars.put("name", learnerName);
        vars.put("email", safe(userDTO.getEmail()));
        vars.put("user_email", safe(userDTO.getEmail()));
        vars.put("mobile_number", safe(userDTO.getMobileNumber()));
        // Payment
        vars.put("amount", amount);
        vars.put("total_amount", amount);
        vars.put("currency", currency);
        vars.put("currency_symbol", currencySymbol(currency));
        vars.put("payment_date", paymentDate);
        vars.put("payment_method", resolvedMethod);
        vars.put("payment_mode", resolvedMethod);
        vars.put("transaction_id", transactionId);
        vars.put("invoice_number", safe(invoiceNumber));
        vars.put("receipt_number", safe(invoiceNumber));
        vars.put("receipt_url", receiptUrl);
        vars.put("invoice_pdf_link", pdfAttached
                ? "Please find your invoice attached to this email."
                : receiptUrl);
        vars.put("course_name", safe(courseName));
        // Institute
        vars.put("institute_name", safe(institute.getInstituteName()));
        vars.put("institute_address", safe(institute.getAddress()));
        vars.put("institute_contact", StringUtils.hasText(institute.getMobileNumber())
                ? institute.getMobileNumber()
                : safe(institute.getEmail()));
        vars.put("institute_email", safe(institute.getEmail()));
        vars.put("institute_website", safe(institute.getWebsiteUrl()));
        vars.put("institute_logo_url", instituteLogoUrl);
        vars.put("institute_logo", StringUtils.hasText(instituteLogoUrl)
                ? "<img src=\"" + instituteLogoUrl + "\" alt=\"" + safe(institute.getInstituteName())
                        + "\" style=\"max-height:60px;\" />"
                : "");
        vars.put("theme_color", safe(institute.getInstituteThemeCode()));
        // General
        vars.put("current_date", LocalDateTime.now().format(DATE_FORMAT));
        vars.put("year", String.valueOf(LocalDateTime.now().getYear()));
        return vars;
    }

    /**
     * Literal {@code {{key}}} substitution, matching UnifiedSendService's own replacement so a
     * template renders the same whichever path sends it. Unknown tokens are left untouched
     * rather than blanked, which makes an authoring typo visible instead of silently empty.
     */
    private String applyPlaceholders(String content, Map<String, String> vars) {
        if (!StringUtils.hasText(content)) {
            return content;
        }
        String filled = content;
        for (Map.Entry<String, String> var : vars.entrySet()) {
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
                .format(DATE_FORMAT);

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
                .format(DATE_FORMAT);

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
