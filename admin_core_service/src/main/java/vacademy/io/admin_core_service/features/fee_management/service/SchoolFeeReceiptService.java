package vacademy.io.admin_core_service.features.fee_management.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.TemplateService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceLineItem;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;
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
 * Service for generating and sending school fee receipts as PDF email
 * attachments.
 * Triggered after offline payment during school enrollment.
 *
 * This service is completely independent of InvoiceService (course invoices).
 * It reads from student_fee_payment table and generates a fee-specific receipt.
 */
@Slf4j
@Service
public class SchoolFeeReceiptService {

    private static final String SCHOOL_FEE_RECEIPT_TEMPLATE_TYPE = "SCHOOL_FEE_RECEIPT";
    private static final String RECEIPT_PREFIX = "RCT";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy");

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceLineItemRepository invoiceLineItemRepository;

    @Autowired
    @Lazy
    private NotificationService notificationService;

    /**
     * Generate a school fee receipt PDF and send it via email.
     * This is the only public method — called from SchoolEnrollService after FIFO
     * allocation.
     *
     * @param userId        Student's user ID
     * @param userPlanId    The user plan ID (links to student_fee_payment rows)
     * @param paymentLogId  The payment log ID for this transaction
     * @param instituteId   The institute ID
     * @param amountPaid    Amount paid in this transaction
     * @param transactionId Manual payment reference (e.g., "CASH-001")
     * @param paymentMode   Payment mode (e.g., "OFFLINE")
     */
    @Transactional
    public void generateAndSendReceipt(String userId, String userPlanId, String paymentLogId,
            String instituteId, BigDecimal amountPaid, String transactionId, String paymentMode) {
        try {
            log.info("Starting school fee receipt generation for userId: {}, userPlanId: {}, instituteId: {}",
                    userId, userPlanId, instituteId);

            // 1. Check if invoice email is enabled
            Institute institute = instituteRepository.findById(instituteId)
                    .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

            Map<String, Object> invoiceSettings = getInvoiceSettings(institute);
            boolean sendEmail = Boolean.TRUE.equals(invoiceSettings.get("sendInvoiceEmail"));
            String currency = (String) invoiceSettings.getOrDefault("currency", "INR");

            // 2. Fetch student info
            UserDTO user = authService.getUsersFromAuthServiceByUserIds(List.of(userId)).get(0);
            if (user == null) {
                log.warn("User not found for receipt generation: {}", userId);
                return;
            }

            // 3. Fetch all fee installments for this user plan
            List<StudentFeePayment> feePayments = studentFeePaymentRepository.findByUserPlanId(userPlanId);
            if (feePayments == null || feePayments.isEmpty()) {
                log.warn("No fee payments found for userPlanId: {}", userPlanId);
                return;
            }

            // 4. Build receipt data
            BigDecimal totalExpected = BigDecimal.ZERO;
            BigDecimal totalPaid = BigDecimal.ZERO;
            BigDecimal totalDiscount = BigDecimal.ZERO;

            for (StudentFeePayment fp : feePayments) {
                totalExpected = totalExpected
                        .add(fp.getAmountExpected() != null ? fp.getAmountExpected() : BigDecimal.ZERO);
                totalPaid = totalPaid.add(fp.getAmountPaid() != null ? fp.getAmountPaid() : BigDecimal.ZERO);
                totalDiscount = totalDiscount
                        .add(fp.getDiscountAmount() != null ? fp.getDiscountAmount() : BigDecimal.ZERO);
            }
            BigDecimal balanceDue = totalExpected.subtract(totalPaid).subtract(totalDiscount);

            // 5. Generate receipt number
            String receiptNumber = generateReceiptNumber(instituteId);

            // 6. Load school fee receipt template
            String templateHtml = loadSchoolFeeReceiptTemplate(instituteId);

            // 7. Build fee table HTML
            String feeTableHtml = buildFeeTableHtml(feePayments, currency);

            // 8. Replace placeholders
            String filledTemplate = replacePlaceholders(templateHtml, user, institute, feePayments,
                    receiptNumber, amountPaid, transactionId, paymentMode,
                    totalExpected, totalPaid, totalDiscount, balanceDue, currency);

            // 9. Generate PDF
            byte[] pdfBytes = generatePdfFromHtml(filledTemplate);

            // 10. Upload to S3
            String pdfFileId = uploadReceiptToS3(pdfBytes, receiptNumber, instituteId);

            // 11. Save to invoice table
            Invoice invoice = saveReceipt(userId, instituteId, receiptNumber, pdfFileId,
                    amountPaid, totalExpected, totalPaid, totalDiscount, balanceDue, currency);

            // 12. Save line items (one per installment)
            saveLineItems(invoice, feePayments, currency);

            log.info("School fee receipt generated successfully: {}", receiptNumber);

            // 13. Send email if enabled
            if (sendEmail) {
                try {
                    sendReceiptEmail(invoice, user, institute, instituteId, pdfBytes, receiptNumber);
                } catch (Exception e) {
                    log.error("Failed to send receipt email for receipt: {}. Receipt generation succeeded.",
                            receiptNumber, e);
                }
            } else {
                log.debug("Receipt email disabled by institute setting for institute: {}", instituteId);
            }

        } catch (Exception e) {
            log.error("Error generating school fee receipt for userId: {}, userPlanId: {}",
                    userId, userPlanId, e);
            // Don't throw — receipt failure should never break enrollment
        }
    }

    // ─── Invoice Settings ────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> getInvoiceSettings(Institute institute) {
        try {
            Object settingData = instituteSettingService.getSettingData(institute, "INVOICE_SETTING");
            if (settingData instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) settingData;
                if (!map.containsKey("sendInvoiceEmail")) {
                    map.put("sendInvoiceEmail", false);
                }
                return map;
            }
        } catch (Exception e) {
            log.warn("Could not load invoice settings for institute: {}. Using defaults.", institute.getId(), e);
        }
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("sendInvoiceEmail", false);
        defaults.put("currency", "INR");
        return defaults;
    }

    // ─── Receipt Number ──────────────────────────────────────────────────────

    private String generateReceiptNumber(String instituteId) {
        String datePrefix = LocalDateTime.now().format(DATE_FORMATTER);
        String baseNumber = RECEIPT_PREFIX + "-" + datePrefix + "-";

        // Find existing receipts with same prefix today
        long count = invoiceRepository.countByInvoiceNumberStartingWith(baseNumber);
        String receiptNumber = baseNumber + String.format("%04d", count + 1);

        // Ensure uniqueness
        while (invoiceRepository.existsByInvoiceNumber(receiptNumber)) {
            receiptNumber = baseNumber + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        }

        log.debug("Generated receipt number: {}", receiptNumber);
        return receiptNumber;
    }

    // ─── Template Loading ────────────────────────────────────────────────────

    private String loadSchoolFeeReceiptTemplate(String instituteId) {
        try {
            var templates = templateService.getTemplatesByInstituteAndType(instituteId,
                    SCHOOL_FEE_RECEIPT_TEMPLATE_TYPE);
            if (!templates.isEmpty()) {
                String content = templates.get(0).getContent();
                if (StringUtils.hasText(content)) {
                    log.debug("Loaded school fee receipt template for institute: {}", instituteId);
                    return content;
                }
            }
        } catch (Exception e) {
            log.warn("Could not load school fee receipt template for institute: {}", instituteId, e);
        }

        log.info("Using default school fee receipt template for institute: {}", instituteId);
        return getDefaultReceiptTemplate();
    }

    /**
     * Default HTML template for school fee receipt.
     * Used when no institute-specific template exists in the templates table.
     */
    private String getDefaultReceiptTemplate() {
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
                        .receipt-meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
                        .receipt-meta-left, .receipt-meta-right { width: 48%; }
                        .receipt-meta-right { text-align: right; }
                        .label { color: #888; font-size: 11px; text-transform: uppercase; }
                        .value { font-weight: bold; font-size: 13px; }
                        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                        th { background-color: #2c5282; color: white; padding: 10px 8px; text-align: left; font-size: 12px; }
                        td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
                        tr:nth-child(even) { background-color: #f7fafc; }
                        .status-PAID { color: #38a169; font-weight: bold; }
                        .status-PARTIAL_PAID { color: #d69e2e; font-weight: bold; }
                        .status-PENDING { color: #e53e3e; font-weight: bold; }
                        .totals { margin-top: 15px; text-align: right; font-size: 13px; }
                        .totals-row { display: flex; justify-content: flex-end; margin: 4px 0; }
                        .totals-label { width: 150px; text-align: right; color: #666; margin-right: 15px; }
                        .totals-value { width: 100px; text-align: right; font-weight: bold; }
                        .grand-total { font-size: 15px; border-top: 2px solid #2c5282; padding-top: 8px; margin-top: 8px; }
                        .payment-info { margin-top: 20px; padding: 12px; background-color: #ebf8ff; border-radius: 6px; font-size: 12px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        {{institute_logo}}
                        <h1>{{institute_name}}</h1>
                        <div class="institute-info">{{institute_address}}</div>
                        <h2>Fee Receipt</h2>
                    </div>

                    <table style="width:100%; border:none; margin-bottom: 15px;">
                        <tr style="background:none;">
                            <td style="border:none; padding:4px;">
                                <span class="label">Receipt No</span><br/>
                                <span class="value">{{receipt_number}}</span>
                            </td>
                            <td style="border:none; padding:4px;">
                                <span class="label">Date</span><br/>
                                <span class="value">{{receipt_date}}</span>
                            </td>
                            <td style="border:none; padding:4px;">
                                <span class="label">Student Name</span><br/>
                                <span class="value">{{student_name}}</span>
                            </td>
                            <td style="border:none; padding:4px; text-align:right;">
                                <span class="label">Payment Mode</span><br/>
                                <span class="value">{{payment_mode}}</span>
                            </td>
                        </tr>
                    </table>

                    {{fee_table}}

                    <div class="totals">
                        <div class="totals-row">
                            <span class="totals-label">Total Expected:</span>
                            <span class="totals-value">{{currency_symbol}} {{total_expected}}</span>
                        </div>
                        <div class="totals-row">
                            <span class="totals-label">Discount:</span>
                            <span class="totals-value">- {{currency_symbol}} {{total_discount}}</span>
                        </div>
                        <div class="totals-row">
                            <span class="totals-label">Total Paid:</span>
                            <span class="totals-value">{{currency_symbol}} {{total_paid}}</span>
                        </div>
                        <div class="totals-row grand-total">
                            <span class="totals-label">Balance Due:</span>
                            <span class="totals-value">{{currency_symbol}} {{balance_due}}</span>
                        </div>
                    </div>

                    <div class="payment-info">
                        <strong>Payment Details:</strong><br/>
                        Amount Paid: {{currency_symbol}} {{amount_paid_now}} |
                        Mode: {{payment_mode}} |
                        Transaction ID: {{transaction_id}}
                    </div>

                    <div class="footer">
                        This is a computer-generated receipt. | {{institute_name}}
                    </div>
                </body>
                </html>
                """;
    }

    // ─── Placeholder Replacement ─────────────────────────────────────────────

    private String replacePlaceholders(String template, UserDTO user, Institute institute,
            List<StudentFeePayment> feePayments, String receiptNumber,
            BigDecimal amountPaid, String transactionId, String paymentMode,
            BigDecimal totalExpected, BigDecimal totalPaid, BigDecimal totalDiscount,
            BigDecimal balanceDue, String currency) {

        String currencySymbol = getCurrencySymbol(currency);
        String studentName = user.getFullName() != null ? user.getFullName() : user.getEmail();
        String instituteName = institute.getInstituteName() != null ? institute.getInstituteName() : "";
        String instituteAddress = buildInstituteAddress(institute);
        String logoHtml = buildInstituteLogoHtml(institute);
        String feeTableHtml = buildFeeTableHtml(feePayments, currency);

        return template
                .replace("{{institute_logo}}", logoHtml)
                .replace("{{institute_name}}", instituteName)
                .replace("{{institute_address}}", instituteAddress)
                .replace("{{receipt_number}}", receiptNumber)
                .replace("{{receipt_date}}", LocalDateTime.now().format(DISPLAY_DATE_FORMATTER))
                .replace("{{student_name}}", studentName)
                .replace("{{student_email}}", user.getEmail() != null ? user.getEmail() : "")
                .replace("{{fee_table}}", feeTableHtml)
                .replace("{{total_expected}}", totalExpected.toPlainString())
                .replace("{{total_paid}}", totalPaid.toPlainString())
                .replace("{{total_discount}}", totalDiscount.toPlainString())
                .replace("{{balance_due}}", balanceDue.toPlainString())
                .replace("{{amount_paid_now}}", amountPaid.toPlainString())
                .replace("{{transaction_id}}", transactionId != null ? transactionId : "N/A")
                .replace("{{payment_mode}}", paymentMode != null ? paymentMode : "OFFLINE")
                .replace("{{currency}}", currency)
                .replace("{{currency_symbol}}", currencySymbol);
    }

    private String buildInstituteAddress(Institute institute) {
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

    private String buildInstituteLogoHtml(Institute institute) {
        if (StringUtils.hasText(institute.getLogoFileId())) {
            try {
                String logoUrl = mediaService.getFileUrlById(institute.getLogoFileId());
                if (StringUtils.hasText(logoUrl)) {
                    return "<img src=\"" + logoUrl + "\" alt=\"Logo\" style=\"max-height: 60px; max-width: 200px;\" />";
                }
            } catch (Exception e) {
                log.debug("Could not load institute logo: {}", e.getMessage());
            }
        }
        return "";
    }

    // ─── Fee Table HTML ──────────────────────────────────────────────────────

    private String buildFeeTableHtml(List<StudentFeePayment> feePayments, String currency) {
        String currencySymbol = getCurrencySymbol(currency);
        StringBuilder sb = new StringBuilder();
        sb.append("<table>");
        sb.append("<tr>")
                .append("<th>#</th>")
                .append("<th>Fee Type</th>")
                .append("<th>Due Date</th>")
                .append("<th>Amount Expected</th>")
                .append("<th>Discount</th>")
                .append("<th>Amount Paid</th>")
                .append("<th>Balance</th>")
                .append("<th>Status</th>")
                .append("</tr>");

        int index = 1;
        for (StudentFeePayment fp : feePayments) {
            BigDecimal expected = fp.getAmountExpected() != null ? fp.getAmountExpected() : BigDecimal.ZERO;
            BigDecimal paid = fp.getAmountPaid() != null ? fp.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal discount = fp.getDiscountAmount() != null ? fp.getDiscountAmount() : BigDecimal.ZERO;
            BigDecimal balance = expected.subtract(paid).subtract(discount);
            String status = fp.getStatus() != null ? fp.getStatus() : "PENDING";
            String dueDate = fp.getDueDate() != null
                    ? new java.text.SimpleDateFormat("dd MMM yyyy").format(fp.getDueDate())
                    : "N/A";

            String feeTypeName = "Facility Fee"; // Default fallback
            if (StringUtils.hasText(fp.getAsvId())) {
                try {
                    AssignedFeeValue afv = assignedFeeValueRepository.findById(fp.getAsvId()).orElse(null);
                    if (afv != null) {
                        FeeType feeType = feeTypeRepository.findById(afv.getFeeTypeId()).orElse(null);
                        if (feeType != null) {
                            feeTypeName = feeType.getName();
                        }
                    }
                } catch (Exception e) {
                    log.warn("Could not fetch fee type name for ASV ID: {}", fp.getAsvId(), e);
                }
            }

            sb.append("<tr>")
                    .append("<td>").append(index++).append("</td>")
                    .append("<td>").append(feeTypeName).append("</td>")
                    .append("<td>").append(dueDate).append("</td>")
                    .append("<td>").append(currencySymbol).append(" ").append(expected.toPlainString()).append("</td>")
                    .append("<td>").append(currencySymbol).append(" ").append(discount.toPlainString()).append("</td>")
                    .append("<td>").append(currencySymbol).append(" ").append(paid.toPlainString()).append("</td>")
                    .append("<td>").append(currencySymbol).append(" ").append(balance.toPlainString()).append("</td>")
                    .append("<td class=\"status-").append(status).append("\">").append(status.replace("_", " "))
                    .append("</td>")
                    .append("</tr>");
        }

        sb.append("</table>");
        return sb.toString();
    }

    // ─── PDF Generation ──────────────────────────────────────────────────────

    private byte[] generatePdfFromHtml(String htmlContent) {
        try {
            String htmlWithCss;
            boolean isCompleteHtml = htmlContent.trim().toLowerCase().startsWith("<!doctype") ||
                    htmlContent.trim().toLowerCase().startsWith("<html");

            if (isCompleteHtml) {
                htmlWithCss = htmlContent;
            } else {
                htmlWithCss = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/></head><body>" +
                        htmlContent + "</body></html>";
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();

            builder.useFont(() -> {
                try {
                    return this.getClass().getResourceAsStream("/fonts/Arial.ttf");
                } catch (Exception e) {
                    return null;
                }
            }, "Arial");

            String baseUri = "file:///";
            builder.withHtmlContent(sanitizeToXhtml(htmlWithCss), baseUri);
            builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM); // A4 portrait

            builder.toStream(outputStream);
            builder.run();

            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Error generating PDF from HTML for school fee receipt", e);
            throw new VacademyException("Failed to generate receipt PDF: " + e.getMessage());
        }
    }

    private String sanitizeToXhtml(String html) {
        // Fix common HTML entities that openhtmltopdf XML parser rejects
        String sanitizedHtml = html
                .replace("&copy;", "&#169;")
                .replace("&nbsp;", "&#160;")
                .replace("&mdash;", "&#8212;")
                .replace("&ndash;", "&#8211;")
                .replace("&reg;", "&#174;");

        Document doc = Jsoup.parse(sanitizedHtml);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        return doc.html();
    }

    // ─── S3 Upload ───────────────────────────────────────────────────────────

    private String uploadReceiptToS3(byte[] pdfBytes, String receiptNumber, String instituteId) {
        try {
            String fileName = "receipt_" + receiptNumber + ".pdf";
            MultipartFile multipartFile = new InMemoryMultipartFile(
                    fileName, fileName, "application/pdf", pdfBytes);

            FileDetailsDTO fileDetails = mediaService.uploadFileV2(multipartFile);
            if (fileDetails != null && fileDetails.getId() != null) {
                log.debug("Receipt PDF uploaded to S3. File ID: {}", fileDetails.getId());
                return fileDetails.getId();
            } else {
                throw new VacademyException("Failed to upload receipt PDF to S3");
            }
        } catch (Exception e) {
            log.error("Error uploading receipt PDF to S3", e);
            throw new VacademyException("Failed to upload receipt PDF: " + e.getMessage());
        }
    }

    // ─── Save to DB ──────────────────────────────────────────────────────────

    private Invoice saveReceipt(String userId, String instituteId, String receiptNumber,
            String pdfFileId, BigDecimal amountPaid,
            BigDecimal totalExpected, BigDecimal totalPaid,
            BigDecimal totalDiscount, BigDecimal balanceDue, String currency) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceNumber(receiptNumber);
        invoice.setUserId(userId);
        invoice.setInstituteId(instituteId);
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setDueDate(LocalDateTime.now());
        invoice.setSubtotal(totalExpected);
        invoice.setDiscountAmount(totalDiscount);
        invoice.setTaxAmount(BigDecimal.ZERO);
        invoice.setTotalAmount(amountPaid);
        invoice.setCurrency(currency);
        invoice.setStatus("GENERATED");
        invoice.setPdfFileId(pdfFileId);
        invoice.setTaxIncluded(false);

        // Save receipt metadata as JSON
        try {
            Map<String, Object> receiptData = new HashMap<>();
            receiptData.put("type", "SCHOOL_FEE_RECEIPT");
            receiptData.put("totalExpected", totalExpected);
            receiptData.put("totalPaid", totalPaid);
            receiptData.put("totalDiscount", totalDiscount);
            receiptData.put("balanceDue", balanceDue);
            receiptData.put("amountPaidNow", amountPaid);
            ObjectMapper objectMapper = new ObjectMapper();
            invoice.setInvoiceDataJson(objectMapper.writeValueAsString(receiptData));
        } catch (Exception e) {
            log.warn("Failed to serialize receipt data to JSON", e);
        }

        invoice = invoiceRepository.save(invoice);
        log.debug("School fee receipt saved to database: {}", receiptNumber);
        return invoice;
    }

    private void saveLineItems(Invoice invoice, List<StudentFeePayment> feePayments, String currency) {
        int index = 1;
        for (StudentFeePayment fp : feePayments) {
            InvoiceLineItem lineItem = new InvoiceLineItem();
            lineItem.setInvoice(invoice);
            lineItem.setItemType("FEE_INSTALLMENT");
            lineItem.setDescription("Installment #" + index + " (Due: "
                    + (fp.getDueDate() != null
                            ? new java.text.SimpleDateFormat("dd MMM yyyy").format(fp.getDueDate())
                            : "N/A")
                    + ")");
            lineItem.setQuantity(1);
            lineItem.setUnitPrice(fp.getAmountExpected() != null ? fp.getAmountExpected() : BigDecimal.ZERO);
            lineItem.setAmount(fp.getAmountPaid() != null ? fp.getAmountPaid() : BigDecimal.ZERO);
            lineItem.setSourceId(fp.getId());
            invoiceLineItemRepository.save(lineItem);
            index++;
        }
    }

    // ─── Email Sending ───────────────────────────────────────────────────────

    private void sendReceiptEmail(Invoice invoice, UserDTO user, Institute institute,
            String instituteId, byte[] pdfBytes, String receiptNumber) {
        try {
            if (user == null || !StringUtils.hasText(user.getEmail())) {
                log.warn("Cannot send receipt email: user or email is null for receipt: {}", receiptNumber);
                return;
            }

            // Load email template
            String subject = "Your Fee Receipt " + receiptNumber;
            String body;

            var emailTemplates = templateService.getTemplatesByInstituteAndType(instituteId, "EMAIL");
            var invoiceEmailTemplate = emailTemplates.stream()
                    .filter(t -> "Invoice Email".equals(t.getName()))
                    .findFirst();

            if (invoiceEmailTemplate.isPresent()) {
                subject = invoiceEmailTemplate.get().getSubject() != null
                        ? invoiceEmailTemplate.get().getSubject()
                        : subject;
                body = invoiceEmailTemplate.get().getContent() != null
                        ? invoiceEmailTemplate.get().getContent()
                        : buildDefaultReceiptEmailBody(user, receiptNumber);
            } else {
                body = buildDefaultReceiptEmailBody(user, receiptNumber);
            }

            // Replace placeholders in email
            String learnerName = user.getFullName() != null ? user.getFullName() : user.getEmail();
            body = body.replace("{{invoice_number}}", receiptNumber)
                    .replace("{{learner_name}}", learnerName)
                    .replace("{{invoice_pdf_link}}", "Please find your fee receipt attached to this email.");
            subject = subject.replace("{{invoice_number}}", receiptNumber)
                    .replace("{{learner_name}}", learnerName);

            // Build attachment
            String attachmentName = "receipt_" + receiptNumber + ".pdf";
            AttachmentUsersDTO.AttachmentDTO attachmentDTO = new AttachmentUsersDTO.AttachmentDTO();
            attachmentDTO.setAttachmentName(attachmentName);
            attachmentDTO.setAttachment(Base64.getEncoder().encodeToString(pdfBytes));

            AttachmentUsersDTO toUser = new AttachmentUsersDTO();
            toUser.setChannelId(user.getEmail());
            toUser.setUserId(user.getId());
            toUser.setPlaceholders(Map.of("email", user.getEmail()));
            toUser.setAttachments(List.of(attachmentDTO));

            AttachmentNotificationDTO attachmentNotification = AttachmentNotificationDTO.builder()
                    .body(body)
                    .subject(subject)
                    .notificationType("EMAIL")
                    .source("SCHOOL_FEE_RECEIPT")
                    .sourceId(invoice.getId())
                    .users(List.of(toUser))
                    .build();

            notificationService.sendAttachmentEmail(List.of(attachmentNotification), instituteId);
            log.info("School fee receipt email sent to {} for receipt: {}", user.getEmail(), receiptNumber);

        } catch (Exception e) {
            log.error("Error sending school fee receipt email", e);
            // Don't throw — email failure shouldn't fail receipt generation
        }
    }

    private String buildDefaultReceiptEmailBody(UserDTO user, String receiptNumber) {
        String learnerName = user.getFullName() != null ? user.getFullName() : "Student";
        return "<html><body>"
                + "<p>Dear " + learnerName + ",</p>"
                + "<p>Please find your fee receipt " + receiptNumber + " attached to this email.</p>"
                + "<p>Thank you for your payment.</p>"
                + "<p>Regards,<br/>Accounts Department</p>"
                + "</body></html>";
    }

    // ─── Currency Helper ─────────────────────────────────────────────────────

    private String getCurrencySymbol(String currencyCode) {
        if (currencyCode == null)
            return "₹";
        return switch (currencyCode.toUpperCase()) {
            case "INR" -> "₹";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            default -> currencyCode;
        };
    }
}
