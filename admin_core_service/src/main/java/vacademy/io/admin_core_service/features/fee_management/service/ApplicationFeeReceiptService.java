package vacademy.io.admin_core_service.features.fee_management.service;

import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.TemplateService;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.dto.InMemoryMultipartFile;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service for generating and sending application fee invoice PDFs via email.
 * Triggered after successful payment (both MANUAL and RAZORPAY flows).
 * Templates are loaded from the DB with hardcoded defaults as fallback.
 *
 * Template types used:
 * - PDF: "APPLICATION_FEE_RECEIPT"
 * - Email: "EMAIL" filtered by name "Application Fee Invoice Email"
 */
@Slf4j
@Service
public class ApplicationFeeReceiptService {

    private static final String PDF_TEMPLATE_TYPE = "APPLICATION_FEE_RECEIPT";
    private static final String EMAIL_TEMPLATE_NAME = "Application Fee Invoice Email";
    private static final String RECEIPT_PREFIX = "APP-FEE";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy");

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    @Lazy
    private NotificationService notificationService;

    /**
     * Main entry point. Generates and emails an application fee invoice PDF.
     *
     * @param applicantId     Applicant ID (for context)
     * @param paymentOptionId Payment option ID (used to get fee name)
     * @param paymentLogId    Payment log ID (stored in invoice)
     * @param instituteId     Institute ID
     * @param amountPaid      Amount paid
     * @param transactionId   Transaction reference (Razorpay payment ID or manual
     *                        TX ID)
     * @param paymentMode     "ONLINE" or "OFFLINE"
     * @param recipientEmail  Email address to send invoice to
     * @param recipientName   Display name of recipient
     */
    public void generateAndSendInvoice(
            String applicantId,
            String paymentOptionId,
            String paymentLogId,
            String instituteId,
            BigDecimal amountPaid,
            String transactionId,
            String paymentMode,
            String recipientEmail,
            String recipientName) {

        try {
            log.info("Starting application fee invoice generation. applicantId={}, paymentLogId={}, instituteId={}",
                    applicantId, paymentLogId, instituteId);

            // 1. Load institute
            Institute institute = instituteRepository.findById(instituteId)
                    .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

            // 2. Load PaymentOption name for invoice description
            String paymentOptionName = "Application Fee";
            try {
                Optional<PaymentOption> optOpt = paymentOptionRepository.findById(paymentOptionId);
                if (optOpt.isPresent() && StringUtils.hasText(optOpt.get().getName())) {
                    paymentOptionName = optOpt.get().getName();
                }
            } catch (Exception e) {
                log.warn("Could not load PaymentOption name for id={}: {}", paymentOptionId, e.getMessage());
            }

            // 3. Generate receipt number
            String receiptNumber = generateReceiptNumber();

            // 4. Load PDF template (DB first, fallback to default)
            String pdfTemplate = loadPdfTemplate(instituteId);

            // 5. Replace placeholders in PDF template
            String filledPdf = replacePdfPlaceholders(pdfTemplate, institute, receiptNumber,
                    recipientName, recipientEmail, paymentOptionName, amountPaid, transactionId, paymentMode);

            // 6. Render HTML → PDF
            byte[] pdfBytes = generatePdfFromHtml(filledPdf);

            // 7. Upload PDF → S3
            String pdfFileId = uploadToS3(pdfBytes, receiptNumber);

            // 8. Save Invoice record
            Invoice invoice = saveInvoice(applicantId, paymentLogId, instituteId, receiptNumber,
                    pdfFileId, amountPaid, paymentOptionName);

            log.info("Application fee invoice saved: {}", receiptNumber);

            // 9. Send email if recipient email is available
            if (StringUtils.hasText(recipientEmail)) {
                try {
                    sendInvoiceEmail(invoice, instituteId, institute, pdfBytes, receiptNumber,
                            recipientEmail, recipientName);
                } catch (Exception e) {
                    log.error("Failed to send invoice email for receipt {}. Invoice DB record was saved.",
                            receiptNumber, e);
                }
            } else {
                log.warn("No recipient email available. Skipping email for receipt: {}", receiptNumber);
            }

        } catch (Exception e) {
            log.error("Error generating application fee invoice for applicantId={}, paymentLogId={}",
                    applicantId, paymentLogId, e);
            // Do NOT rethrow — invoice failure must never break the payment flow
        }
    }

    // ─── Receipt Number ──────────────────────────────────────────────────────

    private String generateReceiptNumber() {
        String datePrefix = LocalDateTime.now().format(DATE_FORMATTER);
        String base = RECEIPT_PREFIX + "-" + datePrefix + "-";
        long count = invoiceRepository.countByInvoiceNumberStartingWith(base);
        String number = base + String.format("%04d", count + 1);
        while (invoiceRepository.existsByInvoiceNumber(number)) {
            number = base + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        }
        return number;
    }

    // ─── Template Loading ────────────────────────────────────────────────────

    private String loadPdfTemplate(String instituteId) {
        try {
            var templates = templateService.getTemplatesByInstituteAndType(instituteId, PDF_TEMPLATE_TYPE);
            if (!templates.isEmpty() && StringUtils.hasText(templates.get(0).getContent())) {
                log.debug("Loaded APPLICATION_FEE_RECEIPT template from DB for institute: {}", instituteId);
                return templates.get(0).getContent();
            }
        } catch (Exception e) {
            log.warn("Could not load APPLICATION_FEE_RECEIPT template for institute: {}", instituteId, e);
        }
        log.info("Using default application fee receipt template for institute: {}", instituteId);
        return getDefaultPdfTemplate();
    }

    private String getDefaultPdfTemplate() {
        return """
                <!DOCTYPE html>
                <html xmlns="http://www.w3.org/1999/xhtml">
                <head>
                    <meta charset="UTF-8" />
                    <style>
                        @page { margin: 15mm; size: A4; }
                        body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2c5282; padding-bottom: 15px; }
                        .header h1 { margin: 0; color: #2c5282; font-size: 22px; }
                        .header h2 { margin: 5px 0 0 0; color: #555; font-size: 14px; font-weight: normal; }
                        .institute-info { text-align: center; font-size: 12px; color: #666; margin-bottom: 5px; }
                        .meta-table { width: 100%; border: none; margin-bottom: 20px; }
                        .meta-table td { border: none; padding: 4px 8px; font-size: 13px; }
                        .label { color: #888; font-size: 11px; text-transform: uppercase; display: block; }
                        .value { font-weight: bold; font-size: 13px; }
                        .fee-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px 20px; margin: 20px 0; background: #f7fafc; }
                        .fee-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
                        .fee-label { color: #555; }
                        .fee-value { font-weight: bold; }
                        .amount-box { text-align: right; font-size: 18px; font-weight: bold; color: #2c5282; margin-top: 15px; }
                        .payment-info { margin-top: 20px; padding: 12px; background-color: #ebf8ff; border-radius: 6px; font-size: 12px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        {{institute_logo}}
                        <h1>{{institute_name}}</h1>
                        <div class="institute-info">{{institute_address}}</div>
                        <h2>Application Fee Receipt</h2>
                    </div>

                    <table class="meta-table">
                        <tr>
                            <td><span class="label">Receipt No</span><span class="value">{{receipt_number}}</span></td>
                            <td><span class="label">Date</span><span class="value">{{receipt_date}}</span></td>
                            <td><span class="label">Applicant Name</span><span class="value">{{student_name}}</span></td>
                            <td style="text-align:right"><span class="label">Payment Mode</span><span class="value">{{payment_mode}}</span></td>
                        </tr>
                    </table>

                    <div class="fee-box">
                        <div class="fee-row">
                            <span class="fee-label">Fee Description</span>
                            <span class="fee-value">{{payment_option_name}}</span>
                        </div>
                        <div class="fee-row">
                            <span class="fee-label">Transaction ID</span>
                            <span class="fee-value">{{transaction_id}}</span>
                        </div>
                    </div>

                    <div class="amount-box">
                        Amount Paid: {{currency_symbol}} {{amount_paid}}
                    </div>

                    <div class="payment-info">
                        <strong>Payment Details:</strong><br/>
                        Amount: {{currency_symbol}} {{amount_paid}} |
                        Mode: {{payment_mode}} |
                        Ref: {{transaction_id}}
                    </div>

                    <div class="footer">
                        This is a computer-generated receipt. | {{institute_name}}
                    </div>
                </body>
                </html>
                """;
    }

    // ─── Placeholder Replacement ─────────────────────────────────────────────

    private String replacePdfPlaceholders(String template, Institute institute, String receiptNumber,
            String recipientName, String recipientEmail, String paymentOptionName,
            BigDecimal amountPaid, String transactionId, String paymentMode) {

        String instituteName = institute.getInstituteName() != null ? institute.getInstituteName() : "";
        String address = buildAddress(institute);
        String logoHtml = buildLogoHtml(institute);
        String symbol = getCurrencySymbol("INR");

        return template
                .replace("{{institute_logo}}", logoHtml)
                .replace("{{institute_name}}", instituteName)
                .replace("{{institute_address}}", address)
                .replace("{{receipt_number}}", receiptNumber)
                .replace("{{receipt_date}}", LocalDateTime.now().format(DISPLAY_DATE_FORMATTER))
                .replace("{{student_name}}", recipientName != null ? recipientName : "")
                .replace("{{student_email}}", recipientEmail != null ? recipientEmail : "")
                .replace("{{payment_option_name}}", paymentOptionName)
                .replace("{{amount_paid}}", amountPaid != null ? amountPaid.toPlainString() : "0")
                .replace("{{transaction_id}}", transactionId != null ? transactionId : "N/A")
                .replace("{{payment_mode}}", paymentMode != null ? paymentMode : "ONLINE")
                .replace("{{currency_symbol}}", symbol)
                .replace("{{currency}}", "INR");
    }

    private String buildAddress(Institute institute) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(institute.getAddress()))
            sb.append(institute.getAddress());
        if (StringUtils.hasText(institute.getCity())) {
            if (sb.length() > 0)
                sb.append(", ");
            sb.append(institute.getCity());
        }
        if (StringUtils.hasText(institute.getState())) {
            if (sb.length() > 0)
                sb.append(", ");
            sb.append(institute.getState());
        }
        if (StringUtils.hasText(institute.getPinCode())) {
            if (sb.length() > 0)
                sb.append(" - ");
            sb.append(institute.getPinCode());
        }
        return sb.toString();
    }

    private String buildLogoHtml(Institute institute) {
        if (StringUtils.hasText(institute.getLogoFileId())) {
            try {
                String url = mediaService.getFileUrlById(institute.getLogoFileId());
                if (StringUtils.hasText(url)) {
                    return "<img src=\"" + url + "\" alt=\"Logo\" style=\"max-height: 60px; max-width: 200px;\" />";
                }
            } catch (Exception e) {
                log.debug("Could not load institute logo: {}", e.getMessage());
            }
        }
        return "";
    }

    // ─── PDF Generation ──────────────────────────────────────────────────────

    private byte[] generatePdfFromHtml(String htmlContent) {
        try {
            boolean isComplete = htmlContent.trim().toLowerCase().startsWith("<!doctype")
                    || htmlContent.trim().toLowerCase().startsWith("<html");
            String html = isComplete ? htmlContent
                    : "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/></head><body>" + htmlContent
                            + "</body></html>";

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.useFont(() -> {
                try {
                    return this.getClass().getResourceAsStream("/fonts/Arial.ttf");
                } catch (Exception e) {
                    return null;
                }
            }, "Arial");
            builder.withHtmlContent(sanitizeToXhtml(html), "file:///");
            builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Error generating PDF for application fee receipt", e);
            throw new VacademyException("Failed to generate receipt PDF: " + e.getMessage());
        }
    }

    private String sanitizeToXhtml(String html) {
        String s = html
                .replace("&copy;", "&#169;")
                .replace("&nbsp;", "&#160;")
                .replace("&mdash;", "&#8212;")
                .replace("&ndash;", "&#8211;")
                .replace("&reg;", "&#174;");
        Document doc = Jsoup.parse(s);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        return doc.html();
    }

    // ─── S3 Upload ───────────────────────────────────────────────────────────

    private String uploadToS3(byte[] pdfBytes, String receiptNumber) {
        String fileName = "app_fee_receipt_" + receiptNumber + ".pdf";
        MultipartFile file = new InMemoryMultipartFile(fileName, fileName, "application/pdf", pdfBytes);
        try {
            FileDetailsDTO details = mediaService.uploadFileV2(file);
            if (details == null || details.getId() == null) {
                throw new VacademyException("Failed to upload application fee receipt PDF to S3");
            }
            log.debug("Application fee receipt PDF uploaded. fileId={}", details.getId());
            return details.getId();
        } catch (java.io.IOException e) {
            throw new VacademyException("Failed to upload application fee receipt PDF to S3: " + e.getMessage());
        }
    }

    // ─── Save Invoice ─────────────────────────────────────────────────────────

    private Invoice saveInvoice(String applicantId, String paymentLogId, String instituteId,
            String receiptNumber, String pdfFileId, BigDecimal amountPaid, String description) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(receiptNumber);
        invoice.setUserId(applicantId); // store applicantId as userId for tracking
        invoice.setInstituteId(instituteId);
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setDueDate(LocalDateTime.now());
        invoice.setSubtotal(amountPaid);
        invoice.setDiscountAmount(BigDecimal.ZERO);
        invoice.setTaxAmount(BigDecimal.ZERO);
        invoice.setTotalAmount(amountPaid);
        invoice.setCurrency("INR");
        invoice.setStatus("GENERATED");
        invoice.setPdfFileId(pdfFileId);
        invoice.setTaxIncluded(false);

        try {
            Map<String, Object> data = new HashMap<>();
            data.put("type", "APPLICATION_FEE_RECEIPT");
            data.put("applicantId", applicantId);
            data.put("paymentLogId", paymentLogId);
            data.put("description", description);
            data.put("amountPaid", amountPaid);
            invoice.setInvoiceDataJson(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(data));
        } catch (Exception e) {
            log.warn("Failed to serialize invoice data JSON", e);
        }

        return invoiceRepository.save(invoice);
    }

    // ─── Email Sending ────────────────────────────────────────────────────────

    private void sendInvoiceEmail(Invoice invoice, String instituteId, Institute institute,
            byte[] pdfBytes, String receiptNumber, String recipientEmail, String recipientName) {

        // Load email template from DB (fallback to default)
        String subject = "Your Application Fee Receipt " + receiptNumber;
        String body;

        try {
            var emailTemplates = templateService.getTemplatesByInstituteAndType(instituteId, "EMAIL");
            var emailTemplate = emailTemplates.stream()
                    .filter(t -> EMAIL_TEMPLATE_NAME.equals(t.getName()))
                    .findFirst();

            if (emailTemplate.isPresent()) {
                if (StringUtils.hasText(emailTemplate.get().getSubject())) {
                    subject = emailTemplate.get().getSubject();
                }
                body = StringUtils.hasText(emailTemplate.get().getContent())
                        ? emailTemplate.get().getContent()
                        : buildDefaultEmailBody(recipientName, receiptNumber);
                log.debug("Using DB email template '{}' for institute: {}", EMAIL_TEMPLATE_NAME, instituteId);
            } else {
                body = buildDefaultEmailBody(recipientName, receiptNumber);
                log.debug("Using default email body for application fee receipt: {}", receiptNumber);
            }
        } catch (Exception e) {
            log.warn("Error loading email template, using default", e);
            body = buildDefaultEmailBody(recipientName, receiptNumber);
        }

        // Replace common placeholders
        String name = recipientName != null ? recipientName : "Applicant";
        body = body
                .replace("{{invoice_number}}", receiptNumber)
                .replace("{{receipt_number}}", receiptNumber)
                .replace("{{learner_name}}", name)
                .replace("{{applicant_name}}", name)
                .replace("{{institute_name}}",
                        institute.getInstituteName() != null ? institute.getInstituteName() : "");
        subject = subject
                .replace("{{invoice_number}}", receiptNumber)
                .replace("{{receipt_number}}", receiptNumber)
                .replace("{{learner_name}}", name)
                .replace("{{applicant_name}}", name);

        // Build attachment
        String attachmentName = "application_fee_receipt_" + receiptNumber + ".pdf";
        AttachmentUsersDTO.AttachmentDTO attachment = new AttachmentUsersDTO.AttachmentDTO();
        attachment.setAttachmentName(attachmentName);
        attachment.setAttachment(Base64.getEncoder().encodeToString(pdfBytes));

        AttachmentUsersDTO toUser = new AttachmentUsersDTO();
        toUser.setChannelId(recipientEmail);
        toUser.setPlaceholders(Map.of("email", recipientEmail));
        toUser.setAttachments(List.of(attachment));

        AttachmentNotificationDTO notification = AttachmentNotificationDTO.builder()
                .body(body)
                .subject(subject)
                .notificationType("EMAIL")
                .source("APPLICATION_FEE_RECEIPT")
                .sourceId(invoice.getId())
                .users(List.of(toUser))
                .build();

        notificationService.sendAttachmentEmail(List.of(notification), instituteId);
        log.info("Application fee invoice email sent to {} for receipt: {}", recipientEmail, receiptNumber);
    }

    private String buildDefaultEmailBody(String recipientName, String receiptNumber) {
        String name = recipientName != null ? recipientName : "Applicant";
        return "<html><body>"
                + "<p>Dear " + name + ",</p>"
                + "<p>Thank you for your application fee payment.</p>"
                + "<p>Please find your receipt <strong>" + receiptNumber + "</strong> attached to this email.</p>"
                + "<p>If you have any questions, please contact us.</p>"
                + "<p>Regards,<br/>Admissions Department</p>"
                + "</body></html>";
    }

    // ─── Currency ─────────────────────────────────────────────────────────────

    private String getCurrencySymbol(String code) {
        if (code == null)
            return "₹";
        return switch (code.toUpperCase()) {
            case "INR" -> "₹";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            default -> code;
        };
    }
}
