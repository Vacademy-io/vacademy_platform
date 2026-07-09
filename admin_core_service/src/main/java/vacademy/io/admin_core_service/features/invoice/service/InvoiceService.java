package vacademy.io.admin_core_service.features.invoice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.TemplateService;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.invoice.dto.*;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceLineItem;
import vacademy.io.admin_core_service.features.invoice.entity.InvoicePaymentLogMapping;
import vacademy.io.admin_core_service.features.invoice.enums.InvoicePdfPlacement;
import vacademy.io.admin_core_service.features.payments.service.PaymentService;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;
import vacademy.io.admin_core_service.features.institute.service.InstitutePaymentGatewayMappingService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoicePaymentLogMappingRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.AttachmentUsersDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLogLineItem;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.invoice.dto.InvoicePackageContextProjection;
import vacademy.io.admin_core_service.features.session.dto.BatchInstituteProjection;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogLineItemRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.dto.InMemoryMultipartFile;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InvoiceService {

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceLineItemRepository invoiceLineItemRepository;

    @Autowired
    private InvoiceBillingProfileService invoiceBillingProfileService;

    @Autowired
    private InvoiceInstituteProfileService invoiceInstituteProfileService;

    @Autowired
    private TemplateService templateService;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private MediaService mediaService;

    @Autowired
    private PaymentLogLineItemRepository paymentLogLineItemRepository;

    @Autowired
    private InvoicePaymentLogMappingRepository invoicePaymentLogMappingRepository;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    // Used by buildSfpInvoiceDTOs() to walk SFP → PaymentLog → Invoice so the synthetic
    // installment rows can carry the real Invoice's pdf_file_id / pdf_url. Avoids the
    // "No PDF" state on PAID/PARTIAL rows that actually have a persisted invoice.
    @Autowired
    private vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository studentFeeAllocationLedgerRepository;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionInvitationRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private vacademy.io.admin_core_service.features.notification_service.service.BillingContactRecipientResolver billingContactRecipientResolver;

    @Autowired
    private vacademy.io.admin_core_service.features.notification_service.service.InvoiceAdminCopyRecipientResolver invoiceAdminCopyRecipientResolver;

    @Autowired
    @Lazy
    private PaymentService paymentService;

    @Autowired
    private InstitutePaymentGatewayMappingService institutePaymentGatewayMappingService;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.repository.AppliedCouponDiscountRepository appliedCouponDiscountRepository;

    // Manual / offline payment recording on admin invoices ("Mark Paid" button).
    // Mirrors the CPO side-view offline flow but tied to an Invoice instead of a
    // UserPlan — userPlan is null on the resulting PaymentLog because admin invoices
    // aren't bound to an enrollment.
    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService paymentLogService;

    @Value("${default.learner.portal.url:https://learner.vacademy.io}")
    private String learnerPortalUrl;

    @Value("${default.learner.portal.invoice.pay.path:/pay/invoice}")
    private String invoicePayPath;

    /** Type for institute invoice PDF layout templates (how line items, totals, etc. are shown in the PDF — like default_invoice.html). Not email templates. */
    private static final String INVOICE_TEMPLATE_TYPE = "INVOICE";
    private static final String INVOICE_STATUS_GENERATED = "GENERATED";

    /**
     * Builds the description text shown on a discount/coupon invoice line item.
     * For COUPON-type rows we look up the actual coupon code (e.g. "SAVE20") via
     * the line item's source_id (FK to AppliedCouponDiscount) so the receipt
     * cites the redeemed code instead of a generic "Discount: coupon" label.
     * Falls back to the legacy "Discount: <source>" string if anything is
     * missing — we never want a malformed lookup to break invoice generation.
     */
    private String buildDiscountDescription(PaymentLogLineItem item) {
        String source = item.getSource();
        String type = item.getType();
        boolean looksLikeCoupon = (type != null && type.toUpperCase().contains("COUPON"))
                || (source != null && source.toLowerCase().contains("coupon"));
        if (looksLikeCoupon && item.getSourceId() != null) {
            try {
                String code = appliedCouponDiscountRepository.findById(item.getSourceId())
                        .map(acd -> acd.getCouponCode() != null ? acd.getCouponCode().getCode() : null)
                        .orElse(null);
                if (code != null && !code.isBlank()) {
                    return "Coupon " + code;
                }
            } catch (Exception e) {
                log.warn("Failed to resolve coupon code for invoice line item {}: {}",
                        item.getId(), e.getMessage());
            }
        }
        return source != null ? "Discount: " + source : "Discount";
    }
    private static final String INVOICE_STATUS_PENDING_PAYMENT = "PENDING_PAYMENT";
    private static final String INVOICE_STATUS_PAID = "PAID";
    // Terminal "voided" status: the admin created the invoice in error (wrong amount,
    // wrong learner, …). The payment link stops working and it can never be marked
    // paid again; it stays in the list for record-keeping. See rejectInvoice().
    private static final String INVOICE_STATUS_REJECTED = "REJECTED";
    // Shared, reused for the invoice_data_json read/merge helpers below — ObjectMapper is
    // thread-safe and expensive to construct; avoid a fresh instance per call/per invoice row.
    private static final ObjectMapper INVOICE_JSON_MAPPER = new ObjectMapper();
    private static final String DEFAULT_INVOICE_PREFIX = "INV";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy");

    // ── Editable-placeholder support (admin invoice preview / overrides) ──────────────
    // Matches {{placeholder}} tokens (lowercase + underscore) in an invoice template.
    private static final java.util.regex.Pattern PLACEHOLDER_PATTERN =
            java.util.regex.Pattern.compile("\\{\\{([a-z_]+)\\}\\}");

    /**
     * Text placeholders an admin may override per-invoice. Anything NOT in this set
     * (derived amounts, currency, HTML blocks like line_items / institute_logo, and the
     * date fields which travel as real timestamps) is ignored if it appears in the
     * overrides map — this whitelist is the security boundary for what admin-supplied
     * text can reach the template.
     */
    private static final Set<String> EDITABLE_OVERRIDE_KEYS = Set.of(
            "invoice_number", "user_name", "user_email", "user_address", "user_tax_info",
            "place_of_supply", "institute_name", "institute_address", "institute_contact",
            "tax_label", "tax_rate", "country", "country_code", "tax_registration_number",
            "hsn_code", "notes");

    /**
     * Overrides that only make sense for a single billed user. Stripped for bulk
     * (multi-user) creation so one user's identity / invoice number can't bleed onto
     * everyone else's invoice (and to avoid unique-invoice-number collisions).
     */
    private static final Set<String> USER_SCOPED_OVERRIDE_KEYS = Set.of(
            "invoice_number", "user_name", "user_email", "user_address", "user_tax_info",
            "place_of_supply");

    /** Display metadata for a template placeholder, powering the review/preview panel. */
    private record PlaceholderMeta(String label, String group, boolean editable, String inputType) {}

    /**
     * Ordered metadata for every placeholder the review panel can surface. Only the
     * entries whose key actually appears in the institute's template are returned by
     * {@link #computeResolvedValues}. Insertion order drives display grouping.
     */
    private static final LinkedHashMap<String, PlaceholderMeta> PLACEHOLDER_META = new LinkedHashMap<>();
    static {
        PLACEHOLDER_META.put("invoice_number", new PlaceholderMeta("Invoice Number", "INVOICE", true, "text"));
        PLACEHOLDER_META.put("invoice_date", new PlaceholderMeta("Invoice Date", "INVOICE", true, "date"));
        PLACEHOLDER_META.put("due_date", new PlaceholderMeta("Due Date", "INVOICE", true, "date"));
        PLACEHOLDER_META.put("user_name", new PlaceholderMeta("Billed To", "BILL TO", true, "text"));
        PLACEHOLDER_META.put("user_email", new PlaceholderMeta("Email", "BILL TO", true, "text"));
        PLACEHOLDER_META.put("user_address", new PlaceholderMeta("Address", "BILL TO", true, "textarea"));
        PLACEHOLDER_META.put("user_tax_info", new PlaceholderMeta("Tax ID (GSTIN/VAT)", "BILL TO", true, "text"));
        PLACEHOLDER_META.put("place_of_supply", new PlaceholderMeta("Place of Supply", "BILL TO", true, "text"));
        PLACEHOLDER_META.put("institute_name", new PlaceholderMeta("Institute Name", "INSTITUTE", true, "text"));
        PLACEHOLDER_META.put("institute_address", new PlaceholderMeta("Institute Address", "INSTITUTE", true, "textarea"));
        PLACEHOLDER_META.put("institute_contact", new PlaceholderMeta("Institute Contact", "INSTITUTE", true, "text"));
        PLACEHOLDER_META.put("tax_label", new PlaceholderMeta("Tax Label", "TAX", true, "text"));
        PLACEHOLDER_META.put("tax_rate", new PlaceholderMeta("Tax Rate", "TAX", true, "text"));
        PLACEHOLDER_META.put("country", new PlaceholderMeta("Country", "TAX", true, "text"));
        PLACEHOLDER_META.put("country_code", new PlaceholderMeta("Country Code", "TAX", true, "text"));
        PLACEHOLDER_META.put("tax_registration_number", new PlaceholderMeta("Tax Registration No.", "TAX", true, "text"));
        PLACEHOLDER_META.put("hsn_code", new PlaceholderMeta("HSN/SAC Code", "TAX", true, "text"));
        PLACEHOLDER_META.put("subtotal", new PlaceholderMeta("Subtotal", "AMOUNTS", false, "text"));
        PLACEHOLDER_META.put("tax_amount", new PlaceholderMeta("Tax Amount", "AMOUNTS", false, "text"));
        PLACEHOLDER_META.put("total_amount", new PlaceholderMeta("Total", "AMOUNTS", false, "text"));
        PLACEHOLDER_META.put("currency", new PlaceholderMeta("Currency", "AMOUNTS", false, "text"));
        PLACEHOLDER_META.put("notes", new PlaceholderMeta("Notes", "NOTES", true, "textarea"));
    }

    /**
     * Unicode font for the invoice PDF. Candidates are checked in order; the first
     * one present on the classpath is embedded (under the family names templates
     * use) so glyphs like the rupee sign (₹) render. If NONE is present, the PDF
     * falls back to the base-14 font (current behavior) and currency symbols fall
     * back to ASCII — so this is fully backward compatible.
     *
     * To enable the real symbols, drop a Unicode TTF (e.g. NotoSans-Regular.ttf or
     * DejaVuSans.ttf) into src/main/resources/fonts/.
     */
    private static final String[] INVOICE_FONT_CANDIDATES = {
            "/fonts/NotoSans-Regular.ttf",
            "/fonts/DejaVuSans.ttf",
    };
    private static final String RESOLVED_INVOICE_FONT_PATH = resolveInvoiceFontResource();
    private static final boolean UNICODE_INVOICE_FONT_AVAILABLE = RESOLVED_INVOICE_FONT_PATH != null;

    private static String resolveInvoiceFontResource() {
        for (String path : INVOICE_FONT_CANDIDATES) {
            try (java.io.InputStream is = InvoiceService.class.getResourceAsStream(path)) {
                if (is != null) {
                    return path;
                }
            } catch (Exception ignored) {
                // try next candidate
            }
        }
        return null;
    }

    /**
     * Looks up the Invoice by id and returns a usable presigned PDF URL. If the row's
     * {@code pdf_file_id} is null (typical when local-dev S3 upload failed at create
     * time), regenerates the PDF, persists the new fileId, and returns the URL — so
     * subsequent reads hit the fast path. Returns null only when the invoice doesn't
     * exist or regeneration fails.
     *
     * <p>This is the single canonical "give me a downloadable PDF for this invoice"
     * path. {@code /v1/invoices/{invoiceId}/download} routes through here; the listing
     * surfaces real invoice ids on synthetic SFP rows (see {@link #buildSfpInvoiceDTOs})
     * so the same endpoint serves both real-Invoice and SFP-derived listings.
     */
    @Transactional
    public String resolveOrRegeneratePdfUrl(String invoiceId) {
        if (invoiceId == null || invoiceId.isBlank()) return null;
        Invoice invoice = invoiceRepository.findById(invoiceId).orElse(null);
        if (invoice == null) return null;
        if (StringUtils.hasText(invoice.getPdfFileId())) {
            String url = mediaService.getFilePublicUrlById(invoice.getPdfFileId());
            if (StringUtils.hasText(url)) return url;
        }
        // Missing or unresolvable fileId → regenerate on demand.
        String regenFileId = regenerateInvoicePdf(invoice);
        if (!StringUtils.hasText(regenFileId)) return null;
        invoice.setPdfFileId(regenFileId);
        invoiceRepository.save(invoice);
        return mediaService.getFilePublicUrlById(regenFileId);
    }

    /**
     * Rebuilds the invoice PDF from the persisted Invoice's data and re-uploads to S3.
     * Returns the new file id, or null if any step fails. Caller is responsible for
     * persisting the new id on the Invoice row.
     */
    private String regenerateInvoicePdf(Invoice invoice) {
        try {
            List<PaymentLog> paymentLogs = invoicePaymentLogMappingRepository
                    .findPaymentLogsByInvoiceId(invoice.getId());
            // Discriminate on UserPlan presence, NOT list emptiness: an admin invoice gains a
            // MANUAL/gateway PaymentLog mapping (with userPlan=null) once payment is initiated or
            // marked paid, so emptiness would wrongly route it to the enrollment builder — which
            // dereferences userPlan and NPEs. Treat it as an admin invoice unless at least one
            // mapped log carries a real UserPlan.
            boolean hasEnrollmentLog = paymentLogs.stream().anyMatch(pl -> pl.getUserPlan() != null);
            InvoiceData invoiceData;
            if (!hasEnrollmentLog) {
                // Admin invoice — rebuild from the persisted row + line items + stored overrides
                // so the PDF regenerates with the admin's edits (independent of payment state).
                invoiceData = buildInvoiceDataFromPersistedInvoice(invoice);
                if (invoiceData == null || invoiceData.getLineItems() == null
                        || invoiceData.getLineItems().isEmpty()) {
                    return null;
                }
            } else {
                // Enrollment invoice — reuse the same builder path generateInvoice uses.
                invoiceData = buildInvoiceDataFromMultiplePaymentLogs(
                        paymentLogs, invoice.getInstituteId());
                // Preserve the original invoice number; this is a PDF refresh, not a new bill.
                invoiceData.setInvoiceNumber(invoice.getInvoiceNumber());
                // Carry forward any admin overrides / notes stored for this invoice.
                applyStoredOverrides(invoice, invoiceData);
            }
            String templateHtml = loadInvoiceTemplate(invoice.getInstituteId());
            String filledTemplate = replaceTemplatePlaceholders(templateHtml, invoiceData);
            byte[] pdfBytes = generatePdfFromHtml(filledTemplate);
            return uploadInvoiceToS3(pdfBytes, invoice.getInvoiceNumber(), invoice.getInstituteId());
        } catch (Exception e) {
            log.warn("regenerateInvoicePdf failed for invoice {}: {}", invoice.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Result of invoice generation: the persisted {@link Invoice}, the freshly-rendered PDF bytes,
     * and whether an invoice already existed for this payment log.
     *
     * <p>{@code pdfBytes} is {@code null} when {@link #isAlreadyExisted()} is true (a duplicate /
     * retried webhook — we do not re-render the PDF in that case) or when generation produced no
     * PDF. Callers that want to attach the PDF elsewhere (e.g. the payment-confirmation email) must
     * null-check it.</p>
     */
    public static class InvoiceGenerationResult {
        private final Invoice invoice;
        private final byte[] pdfBytes;
        private final boolean alreadyExisted;

        public InvoiceGenerationResult(Invoice invoice, byte[] pdfBytes, boolean alreadyExisted) {
            this.invoice = invoice;
            this.pdfBytes = pdfBytes;
            this.alreadyExisted = alreadyExisted;
        }

        public Invoice getInvoice() {
            return invoice;
        }

        public byte[] getPdfBytes() {
            return pdfBytes;
        }

        public boolean isAlreadyExisted() {
            return alreadyExisted;
        }
    }

    /**
     * Main method to generate invoice after payment confirmation
     * This method supports multiple payment logs for a single invoice (v2
     * multi-package enrollments)
     */
    @Transactional
    public Invoice generateInvoice(UserPlan userPlan, PaymentLog paymentLog, String instituteId) {
        return generateInvoice(userPlan, paymentLog, instituteId, true);
    }

    /**
     * Overload that controls whether the invoice email is sent. The online CPO/SCHOOL payment
     * webhook generates the invoice purely so a real, downloadable {@code INV-} record exists,
     * but it already sends its own fee receipt — so it passes {@code sendEmail=false} to avoid a
     * duplicate learner email. All existing callers use the 3-arg overload and keep emailing.
     *
     * @param sendEmail whether to email the generated invoice PDF to the learner
     */
    @Transactional
    public Invoice generateInvoice(UserPlan userPlan, PaymentLog paymentLog, String instituteId, boolean sendEmail) {
        return generateInvoiceWithResult(userPlan, paymentLog, instituteId, sendEmail).getInvoice();
    }

    /**
     * Same as {@link #generateInvoice(UserPlan, PaymentLog, String, boolean)} but also returns the
     * freshly-rendered PDF bytes so callers can attach the invoice to a different email (e.g. the
     * payment-confirmation email when {@code INVOICE_SETTING.invoicePdfPlacement =
     * PAYMENT_CONFIRMATION_EMAIL}). {@code pdfBytes} is null when the invoice already existed
     * (duplicate webhook) — see {@link InvoiceGenerationResult#isAlreadyExisted()}.
     */
    @Transactional
    public InvoiceGenerationResult generateInvoiceWithResult(UserPlan userPlan, PaymentLog paymentLog,
            String instituteId, boolean sendEmail) {
        try {
            log.info("Starting invoice generation for userPlanId: {}, paymentLogId: {}, instituteId: {}",
                    userPlan.getId(), paymentLog.getId(), instituteId);

            // Check if this payment log is already part of an invoice
            if (invoicePaymentLogMappingRepository.existsByPaymentLogId(paymentLog.getId())) {
                log.info("Payment log {} is already part of an invoice. Skipping invoice generation.",
                        paymentLog.getId());
                return new InvoiceGenerationResult(findInvoiceByPaymentLogId(paymentLog.getId()), null, true);
            }

            // Check if this is a v2 multi-package enrollment (has shared order ID)
            List<PaymentLog> paymentLogs = findRelatedPaymentLogsForMultiPackage(paymentLog, instituteId);

            log.info("Generating invoice for {} payment log(s) - {} multi-package enrollment detected",
                    paymentLogs.size(), paymentLogs.size() > 1 ? "v2" : "single");

            // 1. Build invoice data from payment log(s)
            InvoiceData invoiceData = buildInvoiceDataFromMultiplePaymentLogs(paymentLogs, instituteId);

            // 2. Generate invoice number and set it in invoice data
            String invoiceNumber = generateInvoiceNumber(instituteId);
            invoiceData.setInvoiceNumber(invoiceNumber);

            // 3. Load institute-specific template
            String templateHtml = loadInvoiceTemplate(instituteId);

            // 4. Replace placeholders
            String filledTemplate = replaceTemplatePlaceholders(templateHtml, invoiceData);

            // 5. Generate PDF
            byte[] pdfBytes = generatePdfFromHtml(filledTemplate);

            // 6. Upload to AWS S3 and get file ID
            String pdfFileId = uploadInvoiceToS3(pdfBytes, invoiceNumber, instituteId);

            // 7. Save invoice record with payment log(s)
            Invoice invoice = saveInvoiceWithMultiplePaymentLogs(invoiceData, invoiceNumber, pdfFileId,
                    paymentLogs, instituteId);

            // 8. Send email with PDF attached (don't fail if email fails)
            if (sendEmail) {
                try {
                    sendInvoiceEmail(invoice, invoiceData.getUser(), instituteId, pdfBytes);
                } catch (Exception e) {
                    log.error("Failed to send invoice email for invoice: {}. Invoice generation will continue.",
                            invoiceNumber, e);
                }
            }

            log.info("Invoice generated successfully: {} with {} payment log(s)",
                    invoiceNumber, paymentLogs.size());
            return new InvoiceGenerationResult(invoice, pdfBytes, false);

        } catch (Exception e) {
            log.error("Error generating invoice for userPlanId: {}, paymentLogId: {}",
                    userPlan.getId(), paymentLog.getId(), e);
            throw new VacademyException("Failed to generate invoice: " + e.getMessage(), e);
        }
    }

    /**
     * Find invoice by payment log ID
     */
    private Invoice findInvoiceByPaymentLogId(String paymentLogId) {
        List<InvoicePaymentLogMapping> mappings = invoicePaymentLogMappingRepository
                .findByPaymentLog(paymentLogRepository.findById(paymentLogId)
                        .orElseThrow(() -> new VacademyException("Payment log not found: " + paymentLogId)));
        if (mappings.isEmpty()) {
            throw new VacademyException("Invoice not found for payment log: " + paymentLogId);
        }
        return mappings.get(0).getInvoice();
    }

    /**
     * Find related payment logs that should be grouped in the same invoice
     * This method detects v2 multi-package enrollments by checking for payment logs
     * with the same order ID
     *
     * @param paymentLog  The payment log to check for related logs
     * @param instituteId The institute ID
     * @return List of payment logs that should be grouped together (single log if
     *         no related logs found)
     */
    private List<PaymentLog> findRelatedPaymentLogsForMultiPackage(PaymentLog paymentLog, String instituteId) {
        try {
            // Check if this payment log has payment_specific_data with order_id
            String orderId = extractOrderIdFromPaymentLog(paymentLog);

            if (orderId != null && isMultiPackageOrderId(orderId)) {
                log.debug("Detected v2 multi-package order ID: {} for payment log: {}", orderId, paymentLog.getId());

                // Find all payment logs with the same order ID that are PAID and not already
                // invoiced
                List<PaymentLog> relatedLogs = paymentLogRepository.findAllByOrderIdInOriginalRequest(orderId);

                // Filter out logs that are already invoiced and ensure they have correct status
                List<PaymentLog> uninvoicedLogs = relatedLogs.stream()
                        .filter(log -> !invoicePaymentLogMappingRepository.existsByPaymentLogId(log.getId()))
                        .filter(log -> "PAID".equals(log.getPaymentStatus())) // Ensure paid status
                        .collect(Collectors.toList());

                if (uninvoicedLogs.size() > 1) {
                    log.info("Found {} related payment logs for multi-package invoice with order ID: {}",
                            uninvoicedLogs.size(), orderId);
                    return uninvoicedLogs;
                }
            }
        } catch (Exception e) {
            log.warn("Error checking for related payment logs: {}", e.getMessage());
        }

        // Default: return single payment log (backward compatibility)
        log.debug("Using single payment log (no multi-package grouping): {}", paymentLog.getId());
        return List.of(paymentLog);
    }

    /**
     * Extract order ID from payment log's payment_specific_data
     */
    private String extractOrderIdFromPaymentLog(PaymentLog paymentLog) {
        try {
            if (paymentLog.getPaymentSpecificData() != null && !paymentLog.getPaymentSpecificData().isEmpty()) {
                // Parse the JSON payment_specific_data
                ObjectMapper objectMapper = new ObjectMapper();
                @SuppressWarnings("unchecked")
                Map<String, Object> paymentData = objectMapper.readValue(paymentLog.getPaymentSpecificData(),
                        Map.class);

                // Check for originalRequest -> orderId
                if (paymentData.containsKey("originalRequest")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> originalRequest = (Map<String, Object>) paymentData.get("originalRequest");
                    if (originalRequest.containsKey("order_id")) {
                        return (String) originalRequest.get("order_id");
                    }
                    if (originalRequest.containsKey("orderId")) {
                        return (String) originalRequest.get("orderId");
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract order ID from payment log {}: {}", paymentLog.getId(), e.getMessage());
        }
        return null;
    }

    /**
     * Check if order ID indicates a v2 multi-package enrollment
     * v2 API uses order IDs starting with "MP" prefix
     */
    private boolean isMultiPackageOrderId(String orderId) {
        return orderId != null && orderId.startsWith("MP");
    }

    /**
     * Find related payment logs that should be grouped in the same invoice
     *
     * NOTE: This legacy method is kept for backward compatibility but is now
     * replaced by
     * findRelatedPaymentLogsForMultiPackage for v2 multi-package support
     */
    @Deprecated
    private List<PaymentLog> findRelatedPaymentLogs(PaymentLog paymentLog, String instituteId) {
        return findRelatedPaymentLogsForMultiPackage(paymentLog, instituteId);
    }

    /**
     * Build invoice data from multiple PaymentLogs (for multi-batch enrollment)
     * This method works for BOTH single and multiple payment log scenarios:
     * - Single payment log: Creates invoice with 1 line item (1 plan/course)
     * - Multiple payment logs: Creates invoice with multiple line items (multiple
     * plans/courses)
     */
    private InvoiceData buildInvoiceDataFromMultiplePaymentLogs(List<PaymentLog> paymentLogs, String instituteId) {
        if (paymentLogs == null || paymentLogs.isEmpty()) {
            throw new VacademyException("Payment logs list cannot be empty");
        }

        log.debug("Building invoice data from {} payment log(s) - supports both single and multiple scenarios",
                paymentLogs.size());

        // Get first payment log for user and basic info
        PaymentLog firstPaymentLog = paymentLogs.get(0);
        String userId = firstPaymentLog.getUserId();
        if (userId == null) {
            throw new VacademyException("User ID is required in payment log");
        }

        // Fetch user
        UserDTO user = authService.getUsersFromAuthServiceByUserIds(List.of(userId)).get(0);
        if (user == null) {
            throw new VacademyException("User not found: " + userId);
        }

        // Fetch institute
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        // Get invoice settings
        Map<String, Object> invoiceSettings = getInvoiceSettings(institute);
        Boolean taxIncluded = (Boolean) invoiceSettings.getOrDefault("taxIncluded", false);
        Double taxRateValue = invoiceSettings.get("taxRate") != null
                ? ((Number) invoiceSettings.get("taxRate")).doubleValue()
                : 0.0;
        // INVOICE_SETTING.taxRate is stored as a percentage (e.g. 18 for 18%) — same
        // convention createAdminInvoices uses. Convert to a fraction for the math
        // below (`1 + taxRate` divisors etc.). Skipping the /100 made the divisor
        // explode (e.g. 1 + 18 = 19) and the resulting subtotal/tax split nonsensical,
        // which is why the Add User → offline payment → generate-invoice path didn't
        // render visible tax.
        BigDecimal taxRate = BigDecimal.valueOf(taxRateValue)
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);
        String taxLabel = (String) invoiceSettings.getOrDefault("taxLabel", "Tax");

        // Per-package-type tax components (INVOICE_SETTING.country). When any components
        // are configured, tax is computed PER LINE ITEM by the line's package type
        // (falling back to the default list); otherwise the legacy single-rate path
        // (taxRate) runs unchanged so existing institutes are unaffected.
        Map<String, Object> countryConfig = asStringObjectMap(invoiceSettings.get("country"));
        List<Map<String, Object>> defaultTaxComponents = asComponentList(countryConfig.get("taxComponents"));
        Map<String, Object> taxComponentsByType = asStringObjectMap(countryConfig.get("taxComponentsByPackageType"));
        boolean hasComponentConfig = !defaultTaxComponents.isEmpty() || !taxComponentsByType.isEmpty();
        // label -> [rate, summed amount], insertion-ordered for stable rendering.
        java.util.LinkedHashMap<String, BigDecimal[]> componentAccumulator = new java.util.LinkedHashMap<>();
        BigDecimal componentSubtotalSum = BigDecimal.ZERO;
        BigDecimal componentTaxSum = BigDecimal.ZERO;

        // Aggregate data from all payment logs
        BigDecimal totalPaymentAmount = BigDecimal.ZERO;
        BigDecimal totalPlanPrice = BigDecimal.ZERO;
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        List<InvoiceLineItemData> allLineItems = new ArrayList<>();
        // Use currency from payment log (primary source), fallback to plan currency if
        // needed
        String paymentLogCurrency = firstPaymentLog.getCurrency();
        String planCurrency = firstPaymentLog.getUserPlan() != null
                && firstPaymentLog.getUserPlan().getPaymentPlan() != null
                        ? firstPaymentLog.getUserPlan().getPaymentPlan().getCurrency()
                        : null;

        log.info("Building invoice - PaymentLog currency: '{}', Plan currency: '{}'", paymentLogCurrency, planCurrency);

        // Validate and normalize currency - filter out invalid values like "#" or
        // single characters
        String currency = normalizeAndValidateCurrency(paymentLogCurrency, planCurrency);

        log.info("Final currency used for invoice: '{}'", currency);

        String paymentMethod = firstPaymentLog.getVendor();
        String transactionId = firstPaymentLog.getVendorId();
        LocalDateTime paymentDate = firstPaymentLog.getDate() != null
                ? firstPaymentLog.getDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime()
                : LocalDateTime.now();

        // Process each payment log
        for (PaymentLog paymentLog : paymentLogs) {
            if (paymentLog.getUserPlan() == null) {
                log.warn("Payment log {} has no user plan, skipping", paymentLog.getId());
                continue;
            }

            UserPlan userPlan = paymentLog.getUserPlan();
            PaymentPlan paymentPlan = userPlan.getPaymentPlan();
            if (paymentPlan == null) {
                log.warn("User plan {} has no payment plan, skipping", userPlan.getId());
                continue;
            }

            // Get payment log line items (discounts, coupons, etc.)
            List<PaymentLogLineItem> paymentLogLineItems = paymentLogLineItemRepository.findByPaymentLog(paymentLog);

            // Calculate plan price first
            BigDecimal planPrice = BigDecimal.valueOf(paymentPlan.getActualPrice());

            // For multi-package invoices, use the plan's actual_price (per-book price)
            // instead of paymentLog.getPaymentAmount() (which may contain the total gateway charge)
            BigDecimal paymentAmount;
            if (paymentLogs.size() > 1) {
                // Multi-package: each line item should show the individual book price
                paymentAmount = planPrice;
            } else if (paymentLog.getPaymentAmount() != null && paymentLog.getPaymentAmount() > 0) {
                paymentAmount = BigDecimal.valueOf(paymentLog.getPaymentAmount());
            } else {
                paymentAmount = planPrice;
            }
            totalPaymentAmount = totalPaymentAmount.add(paymentAmount);

            // Per-line tax by package type (only when components are configured).
            if (hasComponentConfig) {
                String packageType = resolvePackageType(paymentLog);
                List<Map<String, Object>> comps = effectiveTaxComponents(
                        defaultTaxComponents, taxComponentsByType, packageType);
                BigDecimal rateFraction = totalComponentRateFraction(comps);
                BigDecimal lineSubtotal = paymentAmount.divide(
                        BigDecimal.ONE.add(rateFraction), 2, RoundingMode.HALF_UP);
                componentSubtotalSum = componentSubtotalSum.add(lineSubtotal);
                componentTaxSum = componentTaxSum.add(paymentAmount.subtract(lineSubtotal));
                for (Map<String, Object> comp : comps) {
                    String label = comp.get("label") != null ? comp.get("label").toString() : "";
                    if (label.isEmpty()) {
                        continue;
                    }
                    BigDecimal rate;
                    try {
                        rate = new BigDecimal(comp.get("rate") != null ? comp.get("rate").toString() : "0");
                    } catch (NumberFormatException e) {
                        rate = BigDecimal.ZERO;
                    }
                    BigDecimal amt = lineSubtotal.multiply(rate)
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                    final BigDecimal compRate = rate;
                    BigDecimal[] acc = componentAccumulator.computeIfAbsent(label,
                            k -> new BigDecimal[] { compRate, BigDecimal.ZERO });
                    acc[1] = acc[1].add(amt);
                }
            }

            // Calculate discount for line items display
            BigDecimal discountAmount = calculateDiscountAmount(paymentLogLineItems, planPrice);

            totalPlanPrice = totalPlanPrice.add(planPrice);
            totalDiscountAmount = totalDiscountAmount.add(discountAmount);

            // Build line items for this payment log - use payment amount
            List<InvoiceLineItemData> lineItems = buildLineItemsForPlan(
                    paymentPlan, paymentLogLineItems, paymentLog.getId(), paymentAmount);
            allLineItems.addAll(lineItems);
        }

        // Use payment amount from payment log as the total amount
        BigDecimal totalAmount = totalPaymentAmount;

        // Calculate tax and subtotal.
        BigDecimal subtotal;
        BigDecimal taxAmount;
        String taxLineDescription;
        List<Map<String, Object>> aggregatedTaxComponents = null;

        if (hasComponentConfig) {
            // Per-line per-package-type tax, summed across the invoice.
            subtotal = componentSubtotalSum;
            taxAmount = componentTaxSum;
            taxLineDescription = taxLabel;
            aggregatedTaxComponents = new ArrayList<>();
            for (Map.Entry<String, BigDecimal[]> e : componentAccumulator.entrySet()) {
                Map<String, Object> m = new HashMap<>();
                m.put("label", e.getKey());
                m.put("rate", e.getValue()[0]);
                m.put("amount", e.getValue()[1]);
                aggregatedTaxComponents.add(m);
            }
        } else {
            // Legacy single-rate path: payment amount treated as tax-inclusive total.
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            subtotal = totalAmount.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = totalAmount.subtract(subtotal);
            taxLineDescription = taxLabel + " @ " + taxRate.multiply(BigDecimal.valueOf(100)).setScale(0) + "%";
        }

        // Add tax as line item if applicable
        if (taxAmount != null && taxAmount.compareTo(BigDecimal.ZERO) > 0) {
            InvoiceLineItemData taxItem = InvoiceLineItemData.builder()
                    .itemType("TAX")
                    .description(taxLineDescription)
                    .quantity(1)
                    .unitPrice(taxAmount)
                    .amount(taxAmount)
                    .build();
            allLineItems.add(taxItem);
        }

        // Build invoice data
        InvoiceData invoiceData = InvoiceData.builder()
                .user(user)
                .institute(institute)
                .userPlan(paymentLogs.get(0).getUserPlan()) // Primary user plan for backward compatibility
                .paymentPlan(paymentLogs.get(0).getUserPlan().getPaymentPlan())
                .paymentLog(firstPaymentLog) // Primary payment log
                .paymentLogLineItems(new ArrayList<>()) // Aggregated across all logs
                .invoiceDate(LocalDateTime.now())
                .dueDate(LocalDateTime.now())
                .planPrice(totalPlanPrice)
                .discountAmount(totalDiscountAmount)
                .taxAmount(taxAmount)
                .subtotal(subtotal)
                .totalAmount(totalAmount)
                .currency(currency)
                .taxIncluded(taxIncluded)
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod(paymentMethod)
                .transactionId(transactionId)
                .paymentDate(paymentDate)
                .lineItems(allLineItems)
                .aggregatedTaxComponents(aggregatedTaxComponents)
                .build();

        log.debug("Invoice data built successfully from {} payment logs", paymentLogs.size());
        return invoiceData;
    }

    /**
     * Build line items for a single plan (used in multi-payment log scenario)
     * For multi-package enrollments, creates descriptive line items for each
     * package session
     */
    private List<InvoiceLineItemData> buildLineItemsForPlan(PaymentPlan paymentPlan,
            List<PaymentLogLineItem> paymentLogLineItems,
            String paymentLogId,
            BigDecimal paymentAmount) {
        List<InvoiceLineItemData> lineItems = new ArrayList<>();

        // CPO / fee-installment payments are allocated across specific StudentFeePayment
        // installments (tracked in StudentFeeAllocationLedger). When that's the case, list the
        // installment(s) actually settled by THIS payment instead of a single course/plan line —
        // the package name was misleading on an installment invoice. Regular SUBSCRIPTION/ONE_TIME
        // payments create no ledger rows, so they fall through to the plan line item unchanged.
        List<InvoiceLineItemData> installmentItems = buildInstallmentLineItems(paymentLogId);
        if (!installmentItems.isEmpty()) {
            lineItems.addAll(installmentItems);
        } else {
            // For multi-package enrollments, try to get package session details
            String description = buildPackageSessionDescription(paymentPlan, paymentLogId);

            // Ensure description is never null or empty
            if (description == null || description.trim().isEmpty()) {
                description = paymentPlan != null && paymentPlan.getName() != null ? paymentPlan.getName()
                        : "Package Enrollment";
                log.warn("Using fallback description for payment log: {}", paymentLogId);
            }

            // Main plan item — show GROSS plan price (actualPrice) here so the
            // discount line items can subtract from it visually. Using the net
            // gateway-captured amount instead would render as
            // "Course ₹450, Coupon −₹50" which sums to ₹400 instead of the ₹450
            // actually charged. Falls back to paymentAmount when paymentPlan is
            // unavailable so we don't blank the line.
            BigDecimal grossUnitPrice = paymentPlan != null
                    ? BigDecimal.valueOf(paymentPlan.getActualPrice())
                    : paymentAmount;
            InvoiceLineItemData planItem = InvoiceLineItemData.builder()
                    .itemType("PLAN")
                    .description(description.trim())
                    .quantity(1)
                    .unitPrice(grossUnitPrice)
                    .amount(grossUnitPrice)
                    .sourceId(paymentLogId) // Store payment log ID as source
                    .build();
            lineItems.add(planItem);
        }

        // Discount items for this plan
        for (PaymentLogLineItem item : paymentLogLineItems) {
            if (item.getType() != null && (item.getType().contains("DISCOUNT") ||
                    item.getType().contains("COUPON") || item.getType().contains("REFERRAL"))) {

                BigDecimal discountValue = BigDecimal.ZERO;
                if (item.getAmount() != null) {
                    if (item.getAmount() < 0) {
                        discountValue = BigDecimal.valueOf(Math.abs(item.getAmount()));
                    } else {
                        discountValue = BigDecimal.valueOf(item.getAmount());
                    }
                }

                if (discountValue.compareTo(BigDecimal.ZERO) > 0) {
                    InvoiceLineItemData discountItem = InvoiceLineItemData.builder()
                            .itemType(item.getType())
                            .description(buildDiscountDescription(item))
                            .quantity(1)
                            .unitPrice(discountValue.negate())
                            .amount(discountValue.negate())
                            .sourceId(item.getId())
                            .build();
                    lineItems.add(discountItem);
                }
            }
        }

        return lineItems;
    }

    /**
     * Builds one invoice line item per StudentFeePayment installment actually settled by the
     * given payment log, sourced from {@link StudentFeeAllocationLedger}. This is what turns a
     * CPO / fee-installment invoice from a single "course name" line into the specific
     * installments paid in that transaction.
     *
     * <p>Returns an empty list when the payment log has no ledger rows (i.e. it is not a
     * fee/CPO payment), so the caller falls back to the plan line item and regular
     * SUBSCRIPTION/ONE_TIME invoices are unaffected. Any failure here also returns empty so
     * invoice generation degrades gracefully to the plan line rather than breaking.</p>
     *
     * @param paymentLogId the payment log whose allocations should be itemized
     * @return per-installment line items (possibly empty)
     */
    private List<InvoiceLineItemData> buildInstallmentLineItems(String paymentLogId) {
        List<InvoiceLineItemData> items = new ArrayList<>();
        if (paymentLogId == null) {
            return items;
        }
        try {
            List<vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger> ledgers =
                    studentFeeAllocationLedgerRepository.findByPaymentLogId(paymentLogId);
            if (ledgers == null || ledgers.isEmpty()) {
                return items;
            }

            // A single installment can receive multiple ledger rows; sum what THIS payment
            // allocated to each, preserving first-seen order.
            Map<String, BigDecimal> allocatedBySfp = new java.util.LinkedHashMap<>();
            for (vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger ledger : ledgers) {
                if (ledger.getStudentFeePaymentId() == null) {
                    continue;
                }
                BigDecimal amt = ledger.getAmountAllocated() != null ? ledger.getAmountAllocated() : BigDecimal.ZERO;
                allocatedBySfp.merge(ledger.getStudentFeePaymentId(), amt, BigDecimal::add);
            }
            if (allocatedBySfp.isEmpty()) {
                return items;
            }

            List<StudentFeePayment> sfps = studentFeePaymentRepository.findAllById(allocatedBySfp.keySet());
            // Stable, human-friendly order: by due date ascending (mirrors the fee receipt).
            sfps.sort((a, b) -> {
                java.util.Date da = a.getDueDate();
                java.util.Date db = b.getDueDate();
                if (da == null && db == null) return 0;
                if (da == null) return 1;
                if (db == null) return -1;
                return da.compareTo(db);
            });

            java.text.SimpleDateFormat dueFmt = new java.text.SimpleDateFormat("dd MMM yyyy");
            int index = 1;
            for (StudentFeePayment sfp : sfps) {
                BigDecimal amt = allocatedBySfp.getOrDefault(sfp.getId(), BigDecimal.ZERO);
                String due = sfp.getDueDate() != null ? dueFmt.format(sfp.getDueDate()) : "N/A";
                items.add(InvoiceLineItemData.builder()
                        .itemType("FEE_INSTALLMENT")
                        .description("Installment #" + index + " (Due: " + due + ")")
                        .quantity(1)
                        .unitPrice(amt)
                        .amount(amt)
                        .sourceId(sfp.getId())
                        .build());
                index++;
            }
        } catch (Exception e) {
            log.warn("Failed to build CPO installment line items for paymentLog {}: {}. "
                    + "Falling back to plan line item.", paymentLogId, e.getMessage());
            return new ArrayList<>();
        }
        return items;
    }

    /**
     * Build descriptive text for package session in invoice line item
     * For multi-package enrollments, includes level and session information
     */
    private String buildPackageSessionDescription(PaymentPlan paymentPlan, String paymentLogId) {
        try {
            // Get the payment log to access user plan and enroll invite
            PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId).orElse(null);
            if (paymentLog == null || paymentLog.getUserPlan() == null) {
                log.warn("Payment log or user plan not found for ID: {}", paymentLogId);
                return getFallbackDescription(paymentPlan);
            }

            UserPlan userPlan = paymentLog.getUserPlan();

            // Primary source: EnrollInvite name (always available, contains book name)
            // Format: "{level} {package_name} {session_name}" e.g. "buy Blue umbrella store 1"
            if (userPlan.getEnrollInvite() != null
                    && userPlan.getEnrollInvite().getName() != null
                    && !userPlan.getEnrollInvite().getName().trim().isEmpty()) {
                String enrollInviteName = userPlan.getEnrollInvite().getName().trim();
                log.debug("Using enroll invite name for invoice line item: {}", enrollInviteName);
                return enrollInviteName;
            }

            // Fallback: try to get from package session via SSIGM
            List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository
                    .findAllByUserPlanIdAndStatusIn(userPlan.getId(),
                            List.of("ACTIVE", "INVITED", "ABANDONED_CART", "DETAILS_FILLED"));

            if (mappings != null && !mappings.isEmpty()) {
                StudentSessionInstituteGroupMapping mapping = mappings.get(0);
                String packageSessionId = null;
                if (mapping.getDestinationPackageSession() != null) {
                    packageSessionId = mapping.getDestinationPackageSession().getId();
                } else if (mapping.getPackageSession() != null) {
                    packageSessionId = mapping.getPackageSession().getId();
                }

                if (packageSessionId != null && !packageSessionId.isEmpty()) {
                    Optional<BatchInstituteProjection> batchInfoOpt = packageSessionRepository
                            .findBatchAndInstituteByPackageSessionId(packageSessionId);
                    if (batchInfoOpt.isPresent()) {
                        String batchName = batchInfoOpt.get().getBatchName();
                        if (batchName != null && !batchName.trim().isEmpty()) {
                            return batchName.trim();
                        }
                    }
                }
            }

            log.warn("Could not resolve description from enroll invite or SSIGM for payment log {}", paymentLogId);
        } catch (Exception e) {
            log.error("Error building package session description for payment log {}: {}",
                    paymentLogId, e.getMessage(), e);
        }

        // Final fallback to payment plan name
        return getFallbackDescription(paymentPlan);
    }

    /**
     * Get fallback description when package session info is not available
     */
    private String getFallbackDescription(PaymentPlan paymentPlan) {
        if (paymentPlan == null) {
            return "Package Enrollment";
        }
        String planName = paymentPlan.getName();
        String planDesc = paymentPlan.getDescription();

        if (planName != null && !planName.trim().isEmpty()) {
            if (planDesc != null && !planDesc.trim().isEmpty()) {
                return planName.trim() + " - " + planDesc.trim();
            }
            return planName.trim();
        }

        return "Package Enrollment";
    }

    /**
     * Build invoice data from UserPlan, PaymentLog, and related entities (legacy
     * method for single payment log)
     */
    private InvoiceData buildInvoiceData(UserPlan userPlan, PaymentLog paymentLog, String instituteId) {
        log.debug("Building invoice data for userPlanId: {}", userPlan.getId());

        // Fetch user
        UserDTO user = authService.getUsersFromAuthServiceByUserIds(List.of(userPlan.getUserId())).get(0);
        if (user == null) {
            throw new VacademyException("User not found: " + userPlan.getUserId());
        }

        // Fetch institute
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found: " + instituteId));

        // Get payment plan
        PaymentPlan paymentPlan = userPlan.getPaymentPlan();
        if (paymentPlan == null) {
            throw new VacademyException("Payment plan not found for user plan: " + userPlan.getId());
        }

        // Get payment log line items (discounts, coupons, etc.)
        List<PaymentLogLineItem> paymentLogLineItems = paymentLogLineItemRepository.findByPaymentLog(paymentLog);

        // Get invoice settings from institute
        Map<String, Object> invoiceSettings = getInvoiceSettings(institute);

        // Extract tax configuration
        Boolean taxIncluded = (Boolean) invoiceSettings.getOrDefault("taxIncluded", false);
        Double taxRateValue = invoiceSettings.get("taxRate") != null
                ? ((Number) invoiceSettings.get("taxRate")).doubleValue()
                : 0.0;
        // INVOICE_SETTING.taxRate is stored as a percentage (e.g. 18). Convert to a
        // fraction so the `1 + taxRate` divisor below resolves to e.g. 1.18 (not 19).
        // Mirrors the conversion in createAdminInvoices / buildInvoiceDataFromMultiplePaymentLogs.
        BigDecimal taxRate = BigDecimal.valueOf(taxRateValue)
                .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);
        String taxLabel = (String) invoiceSettings.getOrDefault("taxLabel", "Tax");

        // Use payment amount from payment log
        BigDecimal planPrice = BigDecimal.valueOf(paymentPlan.getActualPrice());
        BigDecimal paymentAmount;

        if (paymentLog.getPaymentAmount() != null && paymentLog.getPaymentAmount() > 0) {
            paymentAmount = BigDecimal.valueOf(paymentLog.getPaymentAmount());
        } else {
            // Fallback to plan price if payment amount is not set
            log.warn("Payment log {} has no payment amount, using plan price {} as fallback",
                    paymentLog.getId(), planPrice);
            paymentAmount = planPrice;
        }

        // Calculate discount for line items display
        BigDecimal discountAmount = calculateDiscountAmount(paymentLogLineItems, planPrice);

        // Use payment amount as total, then calculate tax and subtotal
        BigDecimal totalAmount = paymentAmount;
        BigDecimal subtotal;
        BigDecimal taxAmount;

        if (taxIncluded) {
            // Tax is already included in payment amount
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            subtotal = totalAmount.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = totalAmount.subtract(subtotal);
        } else {
            // Tax is additional, so payment amount = subtotal + tax
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            subtotal = totalAmount.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = totalAmount.subtract(subtotal);
        }

        // Build line items - use package session description instead of plan name
        List<InvoiceLineItemData> lineItems = buildLineItems(paymentPlan, paymentLogLineItems,
                taxIncluded, taxRate, taxLabel, subtotal, taxAmount, totalAmount, paymentLog.getId());

        // Build invoice data
        InvoiceData invoiceData = InvoiceData.builder()
                .user(user)
                .institute(institute)
                .userPlan(userPlan)
                .paymentPlan(paymentPlan)
                .paymentLog(paymentLog)
                .paymentLogLineItems(paymentLogLineItems)
                .invoiceDate(LocalDateTime.now())
                .dueDate(LocalDateTime.now()) // Same as invoice date for one-time payments
                .planPrice(planPrice)
                .discountAmount(discountAmount)
                .taxAmount(taxAmount)
                .subtotal(subtotal)
                .totalAmount(totalAmount)
                .currency(getCurrencyFromPaymentLog(paymentLog, paymentPlan))
                .taxIncluded(taxIncluded)
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod(paymentLog.getVendor())
                .transactionId(paymentLog.getVendorId())
                .paymentDate(paymentLog.getDate() != null
                        ? paymentLog.getDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime()
                        : LocalDateTime.now())
                .lineItems(lineItems)
                .build();

        log.debug("Invoice data built successfully");
        return invoiceData;
    }

    /**
     * Calculate total discount amount from payment log line items
     */
    private BigDecimal calculateDiscountAmount(List<PaymentLogLineItem> lineItems, BigDecimal planPrice) {
        BigDecimal totalDiscount = BigDecimal.ZERO;

        for (PaymentLogLineItem item : lineItems) {
            if (item.getAmount() != null && item.getAmount() < 0) {
                // Discounts are negative amounts
                totalDiscount = totalDiscount.add(BigDecimal.valueOf(Math.abs(item.getAmount())));
            } else if (item.getAmount() != null && item.getAmount() > 0 &&
                    (item.getType() != null && (item.getType().contains("DISCOUNT") ||
                            item.getType().contains("COUPON") || item.getType().contains("REFERRAL")))) {
                // Some systems store discounts as positive amounts
                totalDiscount = totalDiscount.add(BigDecimal.valueOf(item.getAmount()));
            }
        }

        // Ensure discount doesn't exceed plan price
        return totalDiscount.min(planPrice);
    }

    /**
     * Build line items for invoice
     */
    private List<InvoiceLineItemData> buildLineItems(PaymentPlan paymentPlan,
            List<PaymentLogLineItem> paymentLogLineItems,
            Boolean taxIncluded,
            BigDecimal taxRate,
            String taxLabel,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            String paymentLogId) {
        List<InvoiceLineItemData> lineItems = new ArrayList<>();

        // Get package session description (package name) instead of plan name
        String description = buildPackageSessionDescription(paymentPlan, paymentLogId);

        // Ensure description is never null or empty
        if (description == null || description.trim().isEmpty()) {
            description = paymentPlan != null && paymentPlan.getName() != null ? paymentPlan.getName()
                    : "Package Enrollment";
        }

        // Main plan item — show GROSS plan price so the discount line items
        // subtract from it visually. The totalAmount passed in is the net
        // (post-discount) figure from the payment log; using that for the
        // course line would double-count the discount on the rendered
        // invoice. Falls back to totalAmount when paymentPlan is unavailable.
        BigDecimal grossUnitPrice = paymentPlan != null
                ? BigDecimal.valueOf(paymentPlan.getActualPrice())
                : totalAmount;
        InvoiceLineItemData planItem = InvoiceLineItemData.builder()
                .itemType("PLAN")
                .description(description.trim())
                .quantity(1)
                .unitPrice(grossUnitPrice)
                .amount(grossUnitPrice)
                .build();
        lineItems.add(planItem);

        // Discount items
        for (PaymentLogLineItem item : paymentLogLineItems) {
            if (item.getType() != null && (item.getType().contains("DISCOUNT") ||
                    item.getType().contains("COUPON") || item.getType().contains("REFERRAL"))) {

                BigDecimal discountValue = BigDecimal.ZERO;
                if (item.getAmount() != null) {
                    if (item.getAmount() < 0) {
                        discountValue = BigDecimal.valueOf(Math.abs(item.getAmount()));
                    } else {
                        discountValue = BigDecimal.valueOf(item.getAmount());
                    }
                }

                if (discountValue.compareTo(BigDecimal.ZERO) > 0) {
                    InvoiceLineItemData discountItem = InvoiceLineItemData.builder()
                            .itemType(item.getType())
                            .description(buildDiscountDescription(item))
                            .quantity(1)
                            .unitPrice(discountValue.negate())
                            .amount(discountValue.negate())
                            .sourceId(item.getId())
                            .build();
                    lineItems.add(discountItem);
                }
            }
        }

        // Tax item (if applicable)
        if (taxAmount != null && taxAmount.compareTo(BigDecimal.ZERO) > 0) {
            InvoiceLineItemData taxItem = InvoiceLineItemData.builder()
                    .itemType("TAX")
                    .description(taxLabel + " @ " + taxRate.multiply(BigDecimal.valueOf(100)).setScale(0) + "%")
                    .quantity(1)
                    .unitPrice(taxAmount)
                    .amount(taxAmount)
                    .build();
            lineItems.add(taxItem);
        }

        return lineItems;
    }

    /**
     * Get invoice settings from institute.
     * INVOICE_SETTING is a key-value in institute settings; defaults include sendInvoiceEmail: false.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getInvoiceSettings(Institute institute) {
        try {
            Object settingData = instituteSettingService.getSettingData(institute, "INVOICE_SETTING");
            if (settingData instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) settingData;
                // Ensure sendInvoiceEmail has a default when key is missing
                if (!map.containsKey("sendInvoiceEmail")) {
                    map.put("sendInvoiceEmail", false);
                }
                // Default PDF placement: keep the PDF in the dedicated invoice email (legacy behaviour)
                if (!map.containsKey("invoicePdfPlacement")) {
                    map.put("invoicePdfPlacement", InvoicePdfPlacement.INVOICE_EMAIL.name());
                }
                return map;
            }
        } catch (Exception e) {
            log.warn("Could not load invoice settings for institute: {}. Using defaults.", institute.getId(), e);
        }
        // Return default settings (default for send invoice email is false)
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("taxIncluded", false);
        defaults.put("taxRate", 0.0);
        defaults.put("taxLabel", "Tax");
        defaults.put("currency", "INR");
        defaults.put("sendInvoiceEmail", false);
        defaults.put("invoicePdfPlacement", InvoicePdfPlacement.INVOICE_EMAIL.name());
        return defaults;
    }

    /**
     * Resolve where the invoice PDF should be delivered for this institute. Reads
     * {@code INVOICE_SETTING.invoicePdfPlacement}; defaults to {@link InvoicePdfPlacement#INVOICE_EMAIL}
     * when the institute, the setting, or its value is missing/unrecognised.
     */
    public InvoicePdfPlacement getInvoicePdfPlacement(String instituteId) {
        try {
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null) {
                return InvoicePdfPlacement.INVOICE_EMAIL;
            }
            Map<String, Object> settings = getInvoiceSettings(institute);
            return InvoicePdfPlacement.fromSetting(settings.get("invoicePdfPlacement"));
        } catch (Exception e) {
            log.warn("Could not resolve invoicePdfPlacement for institute {} — defaulting to INVOICE_EMAIL",
                    instituteId, e);
            return InvoicePdfPlacement.INVOICE_EMAIL;
        }
    }

    /**
     * Generate unique invoice number
     * Format: INV-YYYYMMDD-SEQUENCE
     */
    private String generateInvoiceNumber(String instituteId) {
        String datePrefix = LocalDateTime.now().format(DATE_FORMATTER);
        String baseNumber = DEFAULT_INVOICE_PREFIX + "-" + datePrefix + "-";

        // Count existing invoices for today
        Long count = invoiceRepository.countByInstituteIdAndInvoiceDate(instituteId, LocalDateTime.now());
        String sequence = String.format("%04d", count + 1);

        String invoiceNumber = baseNumber + sequence;

        // Ensure uniqueness (retry if needed)
        int maxRetries = 10;
        int retry = 0;
        while (invoiceRepository.findByInvoiceNumber(invoiceNumber).isPresent() && retry < maxRetries) {
            count++;
            sequence = String.format("%04d", count + 1);
            invoiceNumber = baseNumber + sequence;
            retry++;
        }

        if (retry >= maxRetries) {
            // Fallback to UUID-based suffix
            invoiceNumber = baseNumber + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        }

        log.debug("Generated invoice number: {}", invoiceNumber);
        return invoiceNumber;
    }

    /**
     * Load institute invoice PDF layout template (defines how the invoice PDF looks: line items, totals, placeholders like default_invoice.html).
     * Uses templates table with type=INVOICE (institute invoice PDF templates), not email templates.
     * If the institute has one or more INVOICE templates, the last-created one is used; otherwise
     * resources/templates/invoice/default_invoice.html is used.
     */
    private String loadInvoiceTemplate(String instituteId) {
        try {
            var templates = templateService.getTemplatesByInstituteAndType(instituteId, INVOICE_TEMPLATE_TYPE);
            log.info("Found {} INVOICE templates for institute: {}", templates.size(), instituteId);
            if (!templates.isEmpty()) {
                String content = templates.get(0).getContent();
                if (StringUtils.hasText(content)) {
                    log.info("Using custom INVOICE template '{}' (id={}) for institute: {}, content length: {}",
                            templates.get(0).getName(), templates.get(0).getId(), instituteId,
                            content.length());
                    return content;
                } else {
                    log.warn("INVOICE template found but content is empty for institute: {}", instituteId);
                }
            }
        } catch (Exception e) {
            log.warn("Could not load institute invoice PDF template from Template entity for institute: {}", instituteId, e);
        }

        log.info("Using default invoice PDF template from resources (default_invoice.html) for institute: {}", instituteId);
        return loadDefaultInvoiceTemplateFromResources();
    }

    /**
     * Load default invoice PDF layout template from
     * resources/templates/invoice/default_invoice.html (same style as institute INVOICE templates).
     */
    private String loadDefaultInvoiceTemplateFromResources() {
        try {
            java.io.InputStream inputStream = this.getClass()
                    .getClassLoader()
                    .getResourceAsStream("templates/invoice/default_invoice.html");
            if (inputStream != null) {
                try (java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(inputStream, java.nio.charset.StandardCharsets.UTF_8))) {
                    StringBuilder template = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        template.append(line).append("\n");
                    }
                    log.debug("Successfully loaded default invoice template from resources");
                    return template.toString();
                }
            } else {
                log.error(
                        "Default invoice template file not found in resources/templates/invoice/default_invoice.html");
                throw new VacademyException(
                        "Default invoice template not found. Please ensure the template file exists at resources/templates/invoice/default_invoice.html");
            }
        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error loading default invoice template from resources", e);
            throw new VacademyException("Failed to load default invoice template: " + e.getMessage());
        }
    }

    /**
     * Replace template placeholders with actual data
     */
    private String replaceTemplatePlaceholders(String template, InvoiceData invoiceData) {
        String filled = template;

        // Log whether template contains any placeholders
        boolean hasPlaceholders = filled.contains("{{");
        log.info("Invoice template has placeholders: {}, template length: {}, first 200 chars: {}",
                hasPlaceholders, filled.length(),
                filled.substring(0, Math.min(200, filled.length())));

        // Admin-supplied per-invoice overrides. When a key is present, its (HTML-escaped)
        // value is used instead of the auto-derived one. `ov` = single-line text,
        // `ovMulti` = multi-line text (newlines → <br/>) for addresses / notes. When no
        // override is present, the derived default is used verbatim (unchanged behaviour).
        final Map<String, String> overrides = invoiceData.getOverrides() != null
                ? invoiceData.getOverrides() : Collections.emptyMap();
        java.util.function.BiFunction<String, String, String> ov = (key, def) ->
                overrides.containsKey(key) ? escapeHtml(overrides.get(key)) : (def != null ? def : "");
        java.util.function.BiFunction<String, String, String> ovMulti = (key, def) ->
                overrides.containsKey(key)
                        ? escapeHtml(overrides.get(key)).replace("\n", "<br/>")
                        : (def != null ? def : "");

        // Basic invoice info
        filled = filled.replace("{{invoice_number}}",
                ov.apply("invoice_number", invoiceData.getInvoiceNumber()));
        filled = filled.replace("{{invoice_date}}",
                ov.apply("invoice_date", invoiceData.getInvoiceDate() != null
                        ? invoiceData.getInvoiceDate().format(DISPLAY_DATE_FORMATTER) : ""));
        filled = filled.replace("{{due_date}}",
                ov.apply("due_date", invoiceData.getDueDate() != null
                        ? invoiceData.getDueDate().format(DISPLAY_DATE_FORMATTER) : ""));

        // Institute info
        Institute institute = invoiceData.getInstitute();
        filled = filled.replace("{{institute_name}}",
                ov.apply("institute_name", institute.getInstituteName()));
        filled = filled.replace("{{institute_address}}",
                ovMulti.apply("institute_address", institute.getAddress()));
        filled = filled.replace("{{institute_contact}}",
                ov.apply("institute_contact", institute.getMobileNumber() != null ? institute.getMobileNumber()
                        : (institute.getEmail() != null ? institute.getEmail() : "")));

        // Institute logo
        String instituteLogoHtml = buildInstituteLogoHtml(institute);
        filled = filled.replace("{{institute_logo}}", instituteLogoHtml);

        // Institute theme color - replace in CSS and HTML
        // Use dark turquoise for BILL TO section and footer
        String defaultColor = "#124a34"; // Dark turquoise
        filled = filled.replace("{{theme_color}}", defaultColor);

        // Table header uses hardcoded orange color (#f78f1e) - no replacement needed

        // User info
        UserDTO user = invoiceData.getUser();
        filled = filled.replace("{{user_name}}", ov.apply("user_name", user.getFullName()));
        filled = filled.replace("{{user_email}}", ov.apply("user_email", user.getEmail()));
        filled = filled.replace("{{user_address}}", ovMulti.apply("user_address", user.getAddressLine()));
        // Buyer tax id (GSTIN/VAT) and place of supply have no auto-source on the user
        // record — they default to empty and are filled by the admin via overrides. Both
        // are substituted here so custom templates that reference them don't leak the raw
        // {{...}} token into the rendered invoice.
        filled = filled.replace("{{user_tax_info}}", ov.apply("user_tax_info", ""));
        filled = filled.replace("{{place_of_supply}}",
                ov.apply("place_of_supply", user.getRegion() != null ? user.getRegion() : ""));
        // Notes (admin-entered). Overridable; defaults to the value carried on InvoiceData.
        filled = filled.replace("{{notes}}", ovMulti.apply("notes", invoiceData.getNotes()));

        // Financial info - format with currency symbol based on currency code
        String invoiceCurrency = invoiceData.getCurrency() != null ? invoiceData.getCurrency() : "INR";
        log.info("Invoice currency from invoiceData: '{}'", invoiceCurrency);
        String currencySymbol = getCurrencySymbol(invoiceCurrency);

        // Final safeguard: ensure currency symbol is never "#"
        if ("#".equals(currencySymbol) || currencySymbol == null || currencySymbol.trim().isEmpty()) {
            log.error("CRITICAL: Currency symbol is '#', null, or empty! Defaulting to ₹. Currency was: '{}'",
                    invoiceCurrency);
            currencySymbol = inrCurrencySymbol();
        }

        log.info("Currency symbol resolved: '{}' for currency code: '{}'", currencySymbol, invoiceCurrency);

        filled = filled.replace("{{subtotal}}",
                invoiceData.getSubtotal() != null ? currencySymbol + invoiceData.getSubtotal().toString()
                        : currencySymbol + "0.00");
        filled = filled.replace("{{tax_amount}}",
                invoiceData.getTaxAmount() != null ? currencySymbol + invoiceData.getTaxAmount().toString()
                        : currencySymbol + "0.00");
        filled = filled.replace("{{total_amount}}",
                invoiceData.getTotalAmount() != null ? currencySymbol + invoiceData.getTotalAmount().toString()
                        : currencySymbol + "0.00");
        filled = filled.replace("{{currency}}", invoiceCurrency);
        // Replace currency_symbol placeholder if template uses it
        filled = filled.replace("{{currency_symbol}}", currencySymbol);

        // Payment info
        filled = filled.replace("{{payment_method}}",
                invoiceData.getPaymentMethod() != null ? invoiceData.getPaymentMethod() : "");
        filled = filled.replace("{{transaction_id}}",
                invoiceData.getTransactionId() != null ? invoiceData.getTransactionId() : "");
        filled = filled.replace("{{payment_date}}",
                invoiceData.getPaymentDate() != null ? invoiceData.getPaymentDate().format(DISPLAY_DATE_FORMATTER)
                        : "");

        // Country & tax registration details (from INVOICE_SETTING.country).
        // These let templates render the operating country, the institute's tax
        // registration number (GSTIN/VAT no.) and a breakdown of tax components.
        Map<String, Object> invoiceSettings = getInvoiceSettings(institute);
        String countryName = "";
        String countryCode = "";
        String taxRegistrationNumber = "";
        String hsnSacCode = "";
        String taxComponentsHtml = "";
        Object countryObj = invoiceSettings.get("country");
        if (countryObj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> country = (Map<String, Object>) countryObj;
            countryName = country.get("name") != null ? country.get("name").toString() : "";
            countryCode = country.get("code") != null ? country.get("code").toString() : "";
            taxRegistrationNumber = country.get("taxRegistrationNumber") != null
                    ? country.get("taxRegistrationNumber").toString() : "";
            hsnSacCode = country.get("hsnSacCode") != null ? country.get("hsnSacCode").toString() : "";
        }
        // Tax components are computed per line item by package type during buildInvoiceData;
        // render the aggregated breakdown (label, rate %, computed amount).
        List<Map<String, Object>> aggComps = invoiceData.getAggregatedTaxComponents();
        if (aggComps != null && !aggComps.isEmpty()) {
            taxComponentsHtml = renderTaxComponentsHtml(aggComps, currencySymbol);
        }
        filled = filled.replace("{{country}}", ov.apply("country", countryName));
        filled = filled.replace("{{country_code}}", ov.apply("country_code", countryCode.toUpperCase()));
        filled = filled.replace("{{tax_registration_number}}",
                ov.apply("tax_registration_number", taxRegistrationNumber));
        filled = filled.replace("{{hsn_code}}", ov.apply("hsn_code", hsnSacCode));
        filled = filled.replace("{{tax_components}}", taxComponentsHtml);
        // Render the EFFECTIVE tax label/rate carried on invoiceData — set by the caller
        // (createAdminInvoices/previewAdminInvoice) from the actual per-invoice tax used in
        // the amount calculation, not a fresh institute-settings lookup. Using the settings
        // value here would desync the displayed rate from the real math whenever an admin
        // overrides the tax rate or disables tax for a single invoice.
        filled = filled.replace("{{tax_label}}", ov.apply("tax_label",
                invoiceData.getTaxLabel() != null ? invoiceData.getTaxLabel() : "Tax"));
        filled = filled.replace("{{tax_rate}}", ov.apply("tax_rate",
                invoiceData.getTaxRate() != null
                        ? formatRate(invoiceData.getTaxRate().multiply(BigDecimal.valueOf(100)))
                        : ""));

        // Line items table
        String lineItemsHtml = buildLineItemsHtml(invoiceData.getLineItems(), invoiceData.getCurrency());
        filled = filled.replace("{{line_items}}", lineItemsHtml);

        // Terms & Conditions
        String termsHtml = buildTermsAndConditionsHtml(invoiceData);
        if (termsHtml == null || termsHtml.trim().isEmpty()) {
            // Strip the entire wrapping block (including the heading) so we don't
            // render an orphan "Terms & Conditions" section when nothing is configured.
            filled = filled.replaceAll(
                    "(?s)<!--\\s*TERMS_AND_CONDITIONS_BLOCK\\s*-->.*?<!--\\s*/TERMS_AND_CONDITIONS_BLOCK\\s*-->",
                    "");
            filled = filled.replace("{{terms_and_conditions}}", "");
        } else {
            // Keep wrapper markers as-is (they are HTML comments, harmless in output)
            filled = filled.replace("{{terms_and_conditions}}", termsHtml);
        }

        return filled;
    }

    /**
     * Render the aggregated tax-component breakdown (computed per line item by
     * package type in buildInvoiceData) into the {{tax_components}} HTML table.
     * Each entry holds: label, rate (percent), amount (already summed). Returns an
     * empty string when nothing is configured so templates can hide the section.
     */
    private String renderTaxComponentsHtml(List<Map<String, Object>> components, String currencySymbol) {
        if (components == null || components.isEmpty()) {
            return "";
        }
        String symbol = currencySymbol != null ? currencySymbol : "";
        StringBuilder sb = new StringBuilder();
        sb.append("<table class=\"tax-components\" style=\"border-collapse:collapse;font-size:12px;\">");
        for (Map<String, Object> comp : components) {
            if (comp == null) {
                continue;
            }
            String label = comp.get("label") != null ? comp.get("label").toString() : "";
            String rate = formatRate(comp.get("rate"));
            if (label.isEmpty() && rate.isEmpty()) {
                continue;
            }
            String amount = comp.get("amount") != null ? comp.get("amount").toString() : "0";
            sb.append("<tr>")
                    .append("<td style=\"padding:2px 12px 2px 0;\">").append(escapeXmlAttributeValue(label))
                    .append("</td>")
                    .append("<td style=\"padding:2px 12px 2px 0;text-align:right;\">")
                    .append(escapeXmlAttributeValue(rate))
                    .append(rate.isEmpty() ? "" : "%")
                    .append("</td>")
                    .append("<td style=\"padding:2px 0;text-align:right;\">")
                    .append(escapeXmlAttributeValue(symbol + amount))
                    .append("</td>")
                    .append("</tr>");
        }
        sb.append("</table>");
        return sb.toString();
    }

    /** Cast a settings value to a String->Object map, or empty map. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> asStringObjectMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : new HashMap<>();
    }

    /** Cast a settings value to a list of component maps, or empty list. */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asComponentList(Object o) {
        return o instanceof List ? (List<Map<String, Object>>) o : new ArrayList<>();
    }

    /**
     * Pick the tax components for a package type: the per-type list when configured
     * and non-empty, otherwise the institute's default list.
     */
    private List<Map<String, Object>> effectiveTaxComponents(List<Map<String, Object>> defaultComponents,
            Map<String, Object> byPackageType, String packageType) {
        if (packageType != null && byPackageType != null) {
            List<Map<String, Object>> forType = asComponentList(byPackageType.get(packageType));
            if (!forType.isEmpty()) {
                return forType;
            }
        }
        return defaultComponents;
    }

    /** Sum of component rates as a fraction (e.g. CGST 9 + SGST 9 -> 0.18). */
    private BigDecimal totalComponentRateFraction(List<Map<String, Object>> components) {
        BigDecimal total = BigDecimal.ZERO;
        if (components == null) {
            return total;
        }
        for (Map<String, Object> comp : components) {
            if (comp == null || comp.get("rate") == null) {
                continue;
            }
            try {
                total = total.add(new BigDecimal(comp.get("rate").toString()));
            } catch (NumberFormatException ignored) {
                // skip non-numeric rates
            }
        }
        return total.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
    }

    /**
     * Resolve the package type for a payment log's line, via
     * UserPlan -> EnrollInvite -> PackageSessionLearnerInvitationToPaymentOption ->
     * PackageSession -> PackageEntity.packageType. Returns the first non-blank type
     * found, or null when it can't be resolved (caller falls back to default tax).
     */
    private String resolvePackageType(PaymentLog paymentLog) {
        try {
            if (paymentLog == null || paymentLog.getUserPlan() == null
                    || paymentLog.getUserPlan().getEnrollInvite() == null) {
                return null;
            }
            String enrollInviteId = paymentLog.getUserPlan().getEnrollInvite().getId();
            if (enrollInviteId == null) {
                return null;
            }
            var rows = packageSessionInvitationRepository
                    .findByEnrollInviteIdAndStatusWithPackageSession(enrollInviteId, List.of("ACTIVE"));
            for (var row : rows) {
                if (row.getPackageSession() != null && row.getPackageSession().getPackageEntity() != null) {
                    String type = row.getPackageSession().getPackageEntity().getPackageType();
                    if (type != null && !type.isBlank()) {
                        return type;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not resolve package type for payment log {}: {}",
                    paymentLog != null ? paymentLog.getId() : null, e.getMessage());
        }
        return null;
    }

    /**
     * Format a tax rate value (Number or String) into a clean display string:
     * whole numbers drop the trailing ".0" (9.0 -> "9"), others keep their value.
     */
    private String formatRate(Object rateObj) {
        if (rateObj == null) {
            return "";
        }
        try {
            double d = Double.parseDouble(rateObj.toString());
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return String.valueOf((long) d);
            }
            return String.valueOf(d);
        } catch (NumberFormatException e) {
            return rateObj.toString();
        }
    }

    /**
     * Build institute logo HTML
     */
    private String buildInstituteLogoHtml(Institute institute) {
        if (institute.getLogoFileId() == null || institute.getLogoFileId().trim().isEmpty()) {
            // Return empty div to maintain layout structure
            return "<div class=\"logo-container\"></div>";
        }

        try {
            // Get logo URL from file ID (public URL without expiry)
            String logoUrl = mediaService.getFilePublicUrlByIdWithoutExpiry(institute.getLogoFileId());
            if (logoUrl != null && !logoUrl.trim().isEmpty()) {
                // S3 presigned URLs contain bare '&' (e.g. ?X-Amz-Algorithm=…&X-Amz-Date=…). XHTML
                // requires those written as &amp; — without this, the PDF builder's SAX parser
                // throws "The entity name must immediately follow the '&'" once the value is
                // serialized into an attribute. processImagesForPdf is supposed to inline the
                // image as base64 (which would also resolve this), but that has a silent
                // fallback: when the S3 fetch fails the raw URL stays in the document, so we
                // need the source-side escape too.
                String safeLogoUrl = escapeXmlAttributeValue(logoUrl);
                String safeAlt = escapeXmlAttributeValue(
                        (institute.getInstituteName() != null ? institute.getInstituteName() : "Logo")
                                + " Logo");
                // Inline size constraints so the logo never overflows, regardless of
                // whether the template defines .logo-container CSS (custom / sample
                // templates often don't).
                return "<div class=\"logo-container\" style=\"max-width:200px;\">"
                        + "<img src=\"" + safeLogoUrl + "\" alt=\"" + safeAlt + "\""
                        + " style=\"max-width:200px;max-height:80px;width:auto;height:auto;display:block;\" />"
                        + "</div>";
            }
        } catch (Exception e) {
            log.warn("Failed to get logo URL for institute: {}. Error: {}",
                    institute.getId(), e.getMessage());
        }

        // Return empty div to maintain layout structure
        return "<div class=\"logo-container\"></div>";
    }

    /**
     * Escape XML special characters for safe insertion into an attribute value.
     * Use whenever raw text or URLs are concatenated into an HTML attribute
     * before the document is parsed as XHTML by openhtmltopdf.
     */
    private static String escapeXmlAttributeValue(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /**
     * Get theme color from institute (for table header)
     * Returns the actual institute theme color, or default dark green if not set
     */
    private String getInstituteThemeColor(Institute institute) {
        if (institute == null || institute.getInstituteThemeCode() == null ||
                institute.getInstituteThemeCode().trim().isEmpty()) {
            return "#1a5f3f"; // Default dark green color
        }

        String themeCode = institute.getInstituteThemeCode().trim();

        // If theme code is already a hex color, return it
        if (themeCode.startsWith("#") && themeCode.length() == 7) {
            return themeCode;
        }

        // If theme code is a hex color without #, add it
        if (themeCode.matches("^[0-9A-Fa-f]{6}$")) {
            return "#" + themeCode;
        }

        return "#1a5f3f"; // Default dark green color
    }

    /**
     * Get theme color from institute (deprecated - kept for backward compatibility)
     * 
     * @deprecated Use getInstituteThemeColor instead
     */
    @Deprecated
    private String getThemeColorFromInstitute(Institute institute) {
        return getInstituteThemeColor(institute);
    }

    /**
     * Build HTML table rows for line items
     */
    /**
     * HTML-escape an admin-supplied override value before it is spliced into the
     * invoice template. Prevents a stray {@code <}/{@code &} from breaking the XHTML the
     * PDF renderer (openhtmltopdf) requires, and neutralises any markup/script in the
     * preview HTML (which is also shown in a sandboxed iframe). The curly braces are also
     * encoded so an override value containing a {@code {{placeholder}}} token cannot be
     * re-expanded by a later substitution pass (template substitution is sequential).
     * Null → empty string.
     */
    private String escapeHtml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;")
                .replace("{", "&#123;")
                .replace("}", "&#125;");
    }

    private String buildLineItemsHtml(List<InvoiceLineItemData> lineItems, String currency) {
        if (lineItems == null || lineItems.isEmpty()) {
            return "<tr><td colspan='4'>No items</td></tr>";
        }

        String currencySymbol = getCurrencySymbol(currency != null ? currency : "INR");

        // Final safeguard: ensure currency symbol is never "#"
        if ("#".equals(currencySymbol) || currencySymbol == null || currencySymbol.trim().isEmpty()) {
            log.error("CRITICAL: Currency symbol is '#', null, or empty! Defaulting to ₹. Currency was: '{}'",
                    currency);
            currencySymbol = inrCurrencySymbol();
        }

        StringBuilder html = new StringBuilder();
        for (InvoiceLineItemData item : lineItems) {
            html.append("<tr>");
            html.append("<td>").append(item.getDescription() != null ? item.getDescription() : "").append("</td>");
            html.append("<td class=\"right text-center\" style=\"text-align:center\">")
                    .append(item.getQuantity() != null ? item.getQuantity() : 1).append("</td>");
            // Format unit price with currency symbol
            String unitPrice = item.getUnitPrice() != null ? item.getUnitPrice().toString() : "0.00";
            html.append("<td class=\"right text-right\" style=\"text-align:right\">")
                    .append(currencySymbol).append(unitPrice).append("</td>");
            // Format amount with currency symbol
            String amount = item.getAmount() != null ? item.getAmount().toString() : "0.00";
            html.append("<td class=\"right text-right\" style=\"text-align:right\">")
                    .append(currencySymbol).append(amount).append("</td>");
            html.append("</tr>");
        }
        return html.toString();
    }

    /**
     * Resolve the Terms &amp; Conditions HTML for an invoice.
     *
     * Reads {@code INVOICE_SETTING.termsAndConditions} from the institute settings:
     * <pre>
     * {
     *   "default":   "&lt;ul&gt;...&lt;/ul&gt;",
     *   "byLevel":   { "buy": "...", "rent": "..." },
     *   "byPackage": { "&lt;package_uuid&gt;": "..." }
     * }
     * </pre>
     *
     * Resolution precedence per invoice (invoices are type-homogeneous, so we
     * resolve from the primary user plan): {@code byPackage[packageId]} →
     * {@code byLevel[levelName]} → {@code default}. Returns an empty string when
     * nothing matches, which lets the caller drop the surrounding section.
     */
    @SuppressWarnings("unchecked")
    private String buildTermsAndConditionsHtml(InvoiceData invoiceData) {
        if (invoiceData == null || invoiceData.getInstitute() == null) {
            return "";
        }

        Map<String, Object> invoiceSettings = getInvoiceSettings(invoiceData.getInstitute());
        Object tncRaw = invoiceSettings.get("termsAndConditions");
        if (!(tncRaw instanceof Map)) {
            return "";
        }
        Map<String, Object> tnc = (Map<String, Object>) tncRaw;

        String packageId = null;
        String levelId = null;
        String sessionId = null;

        try {
            UserPlan userPlan = invoiceData.getUserPlan();
            if (userPlan != null) {
                List<StudentSessionInstituteGroupMapping> mappings = studentSessionRepository
                        .findAllByUserPlanIdAndStatusIn(userPlan.getId(),
                                List.of("ACTIVE", "INVITED", "ABANDONED_CART", "DETAILS_FILLED"));
                if (mappings != null && !mappings.isEmpty()) {
                    StudentSessionInstituteGroupMapping mapping = mappings.get(0);
                    String packageSessionId = null;
                    if (mapping.getDestinationPackageSession() != null) {
                        packageSessionId = mapping.getDestinationPackageSession().getId();
                    } else if (mapping.getPackageSession() != null) {
                        packageSessionId = mapping.getPackageSession().getId();
                    }
                    if (packageSessionId != null && !packageSessionId.isEmpty()) {
                        Optional<InvoicePackageContextProjection> ctx = packageSessionRepository
                                .findPackageAndLevelByPackageSessionId(packageSessionId);
                        if (ctx.isPresent()) {
                            packageId = ctx.get().getPackageId();
                            levelId = ctx.get().getLevelId();
                            sessionId = ctx.get().getSessionId();
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to resolve package/level/session context for T&C lookup: {}", e.getMessage());
        }

        // 1) Per-package override
        if (packageId != null) {
            Object byPackageRaw = tnc.get("byPackage");
            if (byPackageRaw instanceof Map) {
                Object html = ((Map<String, Object>) byPackageRaw).get(packageId);
                if (html instanceof String && !((String) html).trim().isEmpty()) {
                    return (String) html;
                }
            }
        }

        // 2) Per-session fallback
        if (sessionId != null) {
            Object bySessionRaw = tnc.get("bySession");
            if (bySessionRaw instanceof Map) {
                Object html = ((Map<String, Object>) bySessionRaw).get(sessionId);
                if (html instanceof String && !((String) html).trim().isEmpty()) {
                    return (String) html;
                }
            }
        }

        // 3) Per-level fallback
        if (levelId != null) {
            Object byLevelRaw = tnc.get("byLevel");
            if (byLevelRaw instanceof Map) {
                Object html = ((Map<String, Object>) byLevelRaw).get(levelId);
                if (html instanceof String && !((String) html).trim().isEmpty()) {
                    return (String) html;
                }
            }
        }

        // 4) Institute-wide default
        Object defaultHtml = tnc.get("default");
        if (defaultHtml instanceof String && !((String) defaultHtml).trim().isEmpty()) {
            return (String) defaultHtml;
        }

        return "";
    }

    /**
     * Get currency from payment log with proper fallback
     */
    private String getCurrencyFromPaymentLog(PaymentLog paymentLog, PaymentPlan paymentPlan) {
        String paymentLogCurrency = paymentLog != null ? paymentLog.getCurrency() : null;
        String planCurrency = paymentPlan != null ? paymentPlan.getCurrency() : null;

        log.info("Getting currency - PaymentLog currency: '{}', Plan currency: '{}'", paymentLogCurrency, planCurrency);

        // Validate and normalize currency
        String currency = normalizeAndValidateCurrency(paymentLogCurrency, planCurrency);

        log.info("Final currency selected: '{}'", currency);
        return currency;
    }

    /**
     * Normalize and validate currency code, filtering out invalid values like "#"
     * or symbols
     */
    private String normalizeAndValidateCurrency(String paymentLogCurrency, String planCurrency) {
        // List of valid currency codes
        Set<String> validCurrencyCodes = Set.of("INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED");

        // Try payment log currency first
        if (paymentLogCurrency != null && !paymentLogCurrency.trim().isEmpty()) {
            String normalized = paymentLogCurrency.trim().toUpperCase();
            // Reject if it's a single character (like "#") or not a valid currency code
            if (normalized.length() >= 3
                    && (validCurrencyCodes.contains(normalized) || normalized.matches("^[A-Z]{3}$"))) {
                log.debug("Using payment log currency: '{}'", normalized);
                return normalized;
            } else {
                log.warn("Invalid payment log currency code: '{}', trying plan currency", paymentLogCurrency);
            }
        }

        // Try plan currency
        if (planCurrency != null && !planCurrency.trim().isEmpty()) {
            String normalized = planCurrency.trim().toUpperCase();
            if (normalized.length() >= 3
                    && (validCurrencyCodes.contains(normalized) || normalized.matches("^[A-Z]{3}$"))) {
                log.debug("Using plan currency: '{}'", normalized);
                return normalized;
            } else {
                log.warn("Invalid plan currency code: '{}', defaulting to INR", planCurrency);
            }
        }

        // Default to INR
        log.info("No valid currency found, defaulting to INR");
        return "INR";
    }

    /** INR symbol: the ₹ glyph when a Unicode font is embedded, else ASCII "Rs. ". */
    private String inrCurrencySymbol() {
        return UNICODE_INVOICE_FONT_AVAILABLE ? "₹" : "Rs. ";
    }

    /**
     * Get currency symbol based on currency code
     * This method ensures we never return "#" or invalid symbols
     */
    private String getCurrencySymbol(String currencyCode) {
        if (currencyCode == null || currencyCode.trim().isEmpty()) {
            log.debug("Currency code is null or empty, defaulting to INR symbol");
            return inrCurrencySymbol();
        }

        // Normalize currency code: trim whitespace and convert to uppercase
        String normalizedCurrency = currencyCode.trim().toUpperCase();

        // Reject invalid currency codes (single characters, symbols, etc.)
        if (normalizedCurrency.length() < 3 || normalizedCurrency.equals("#") ||
                normalizedCurrency.matches("^[#\\$€£¥₹]+$")) {
            log.warn("Invalid currency code detected: '{}', defaulting to INR symbol", currencyCode);
            return inrCurrencySymbol();
        }

        // Log the currency code being used for debugging
        log.debug("Getting currency symbol for currency code: '{}' (normalized: '{}')", currencyCode,
                normalizedCurrency);

        switch (normalizedCurrency) {
            case "INR":
                return inrCurrencySymbol();
            case "USD":
                return "$";
            case "EUR":
                return "€";
            case "GBP":
                return "£";
            case "JPY":
                return "¥";
            case "AUD":
                return "$"; // Australian Dollar uses $ symbol
            case "CAD":
                return "C$";
            case "SGD":
                return "S$";
            case "AED":
                return "AED "; // UAE Dirham (ASCII so it renders in the PDF font)
            // The remaining currencies the frontend's CURRENCY_OPTIONS dropdown offers
            // (frontend-admin-dashboard/src/constants/currencies.ts) — every currency
            // selectable in step 1 must resolve here, or it silently falls back to ₹
            // below. ASCII symbols throughout so no Unicode font dependency.
            case "SAR":
                return "SR "; // Saudi Riyal
            case "QAR":
                return "QR "; // Qatari Riyal
            case "HKD":
                return "HK$"; // Hong Kong Dollar
            case "NZD":
                return "NZ$"; // New Zealand Dollar
            case "CHF":
                return "CHF "; // Swiss Franc
            case "ZAR":
                return "R "; // South African Rand
            case "MYR":
                return "RM "; // Malaysian Ringgit
            default:
                log.warn("Unknown currency code: '{}', defaulting to INR symbol instead of using code as symbol",
                        normalizedCurrency);
                // Always default to INR symbol for unknown currencies to avoid showing invalid
                // symbols
                return inrCurrencySymbol();
        }
    }

    /**
     * Strip {@code @media ... screen ... { ... }} wrappers, promoting their contained CSS rules
     * to unconditional top-level rules. See the call site in {@link #generatePdfFromHtml} for
     * why: openhtmltopdf never matches a "screen" media context, so a template's screen-gated
     * rules (MJML's responsive column widths, in practice) would otherwise be silently dropped
     * in the PDF. Non-screen media blocks (e.g. {@code @media print}) are left untouched.
     * Best-effort: an unbalanced/malformed block is left as-is rather than risking corrupting
     * the rest of the document.
     */
    private String unwrapScreenMediaQueries(String html) {
        // Matches the "@media ... screen ..." prelude up to (not including) its opening '{'.
        // Deliberately broad ("screen" anywhere in the prelude) so it also catches
        // "@media screen and (min-width:480px)" and "@media only screen and (...)" variants,
        // and comma-separated lists like "@media print, screen".
        java.util.regex.Pattern mediaStart = java.util.regex.Pattern.compile(
                "@media\\s+[^{]*\\bscreen\\b[^{]*\\{", java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher m = mediaStart.matcher(html);
        StringBuilder out = new StringBuilder();
        int cursor = 0;
        while (cursor <= html.length() && m.find(cursor)) {
            int preludeStart = m.start();
            int braceOpen = m.end() - 1; // index of the matched '{'
            int depth = 1;
            int i = braceOpen + 1;
            while (i < html.length() && depth > 0) {
                char c = html.charAt(i);
                if (c == '{') depth++;
                else if (c == '}') depth--;
                i++;
            }
            if (depth != 0) {
                break; // unbalanced — bail out, leave the remainder of the document untouched
            }
            int blockEnd = i; // index just past the matching '}'
            out.append(html, cursor, preludeStart);
            out.append(html, braceOpen + 1, blockEnd - 1); // the block's inner rules, unwrapped
            cursor = blockEnd;
        }
        out.append(html.substring(cursor));
        return out.toString();
    }

    /**
     * Generate PDF from HTML
     */
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

            // MJML-compiled custom invoice templates (built via the admin template editor) gate
            // their responsive column widths (e.g. .mj-column-per-50 { width:50% !important })
            // behind `@media only screen and (min-width:480px) { ... }`. PdfRendererBuilder never
            // sets a CSS media type, so openhtmltopdf's print/no-media context never matches
            // "screen" and the whole block is silently skipped — the two-column FROM/BILL TO /
            // header layout collapses to stacked 100%-width blocks in the PDF even though the
            // identical HTML renders correctly (side-by-side) in a browser (the live preview
            // iframe, which is NOT run through this method). A PDF page is always "wide enough",
            // so unconditionally applying the desktop/screen variant is exactly what we want —
            // only the PDF path is touched; the preview HTML returned to the frontend is
            // unaffected.
            htmlWithCss = unwrapScreenMediaQueries(htmlWithCss);

            // Force the embedded Unicode font everywhere so glyphs like ₹ always render,
            // regardless of the template's own font-family (an unmatched family would fall
            // back to a base-14 font that lacks ₹ and render it as '#'). No-op when no
            // Unicode font is bundled (keeps the base-14 behavior).
            if (UNICODE_INVOICE_FONT_AVAILABLE) {
                String forceFontStyle =
                        "<style>*{font-family:'DejaVu Sans','NotoSans',sans-serif !important;}</style>";
                if (htmlWithCss.toLowerCase().contains("</head>")) {
                    htmlWithCss = htmlWithCss.replaceFirst("(?i)</head>", forceFontStyle + "</head>");
                } else if (htmlWithCss.toLowerCase().contains("<body")) {
                    htmlWithCss = htmlWithCss.replaceFirst("(?i)(<body[^>]*>)", "$1" + forceFontStyle);
                } else {
                    htmlWithCss = forceFontStyle + htmlWithCss;
                }
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();

            registerInvoicePdfFonts(builder);

            String processedHtml = processImagesForPdf(htmlWithCss);
            String sanitized = sanitizeToXhtml(processedHtml);
            // Defensive last-mile fixup: openhtmltopdf parses input strictly as XML, so any
            // remaining bare '&' (typical sources: URLs inside <style>/CDATA blocks that
            // Jsoup serializes verbatim, custom institute templates that hand-wrote a URL
            // with raw '&') would throw "The entity name must immediately follow the '&'".
            // Replace bare '&' (one not followed by a recognised entity reference) with &amp;.
            String xhtml = escapeBareAmpersands(sanitized);
            String baseUri = "file:///";

            try {
                builder.withHtmlContent(xhtml, baseUri);
                builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM); // A4 portrait
                builder.toStream(outputStream);
                builder.run();
            } catch (Exception renderError) {
                // Persist the rendered HTML that failed to parse so the operator can grep for
                // the exact byte sequence at the column the SAX parser reported. This catch
                // only fires AFTER the bare-& fixup, so anything reaching here is a different
                // XML issue (unclosed tag, etc.).
                dumpHtmlForDebugging(xhtml, renderError);
                throw renderError;
            }

            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Error generating PDF from HTML", e);
            throw new VacademyException("Failed to generate PDF: " + e.getMessage(), e);
        }
    }

    /**
     * Register the embedded Unicode font (if present) under the family names that
     * invoice templates commonly reference, so existing, custom and sample
     * templates all pick it up and render glyphs like ₹. When no font is bundled,
     * this is a no-op and the renderer uses its base-14 fallback (unchanged
     * behavior) — nothing breaks.
     */
    private void registerInvoicePdfFonts(PdfRendererBuilder builder) {
        if (!UNICODE_INVOICE_FONT_AVAILABLE) {
            return;
        }
        String[] families = { "Arial", "Helvetica", "Cairo", "sans-serif", "NotoSans", "DejaVu Sans" };
        for (String family : families) {
            builder.useFont(() -> InvoiceService.class.getResourceAsStream(RESOLVED_INVOICE_FONT_PATH), family);
        }
    }

    /**
     * Replace bare '&' (one not introducing a known XML/HTML entity) with '&amp;'.
     * Recognised forms left alone: named entities like &amp; &lt; &copy; &nbsp; &times;
     * (any '&' followed by an ASCII letter then word chars then ';'), decimal numeric
     * entities &#123; and hex numeric entities &#x1A;. Anything else, including the
     * '&X-Amz-…' query separators in S3 presigned URLs, gets escaped.
     */
    private static String escapeBareAmpersands(String xhtml) {
        if (xhtml == null) {
            return null;
        }
        return xhtml.replaceAll("&(?![A-Za-z][A-Za-z0-9]*;|#[0-9]+;|#x[0-9A-Fa-f]+;)", "&amp;");
    }

    /**
     * Write the failing HTML to a temp file (and a snippet to the log) so the operator
     * can see exactly what tripped openhtmltopdf's parser. Best-effort — never throws.
     */
    private static void dumpHtmlForDebugging(String html, Throwable cause) {
        try {
            java.nio.file.Path dump = java.nio.file.Files.createTempFile("invoice-pdf-fail-", ".html");
            java.nio.file.Files.writeString(dump, html, java.nio.charset.StandardCharsets.UTF_8);
            log.error("Failing invoice HTML written to {} (size={} chars). Cause: {}", dump,
                    html.length(), cause.getMessage());
            // Try to surface the line/column the SAX parser blamed (format:
            // "lineNumber: 383; columnNumber: 19;") so the snippet is useful even
            // without opening the file.
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("lineNumber:\\s*(\\d+);\\s*columnNumber:\\s*(\\d+)")
                    .matcher(cause.getMessage() == null ? "" : cause.getMessage());
            if (m.find()) {
                int line = Integer.parseInt(m.group(1));
                int col = Integer.parseInt(m.group(2));
                String[] lines = html.split("\\r?\\n", -1);
                if (line - 1 < lines.length) {
                    String offending = lines[line - 1];
                    int from = Math.max(0, col - 30);
                    int to = Math.min(offending.length(), col + 30);
                    log.error("Offending content around line {} col {}: '...{}...'", line, col,
                            offending.substring(from, to));
                }
            }
        } catch (Exception dumpErr) {
            log.warn("Could not write invoice HTML debug dump: {}", dumpErr.getMessage());
        }
    }

    /**
     * Sanitize HTML to XHTML
     */
    private String sanitizeToXhtml(String html) {
        Document doc = Jsoup.parse(html);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        return doc.html();
    }

    /**
     * Process images for PDF (convert URLs to base64)
     */
    private String processImagesForPdf(String html) {
        try {
            Document doc = Jsoup.parse(html);
            doc.select("img[src]").forEach(img -> {
                String src = img.attr("src");
                if (src != null && src.startsWith("http")) {
                    String base64 = convertUrlToBase64(src);
                    if (base64 != null) {
                        img.attr("src", base64);
                    }
                }
            });
            return doc.html();
        } catch (Exception e) {
            log.warn("Error processing images for PDF, using original HTML", e);
            return html;
        }
    }

    /**
     * Convert image URL to base64
     */
    private String convertUrlToBase64(String imageUrl) {
        try {
            java.net.URL url = new java.net.URL(imageUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (PDF Generator)");

            if (connection.getResponseCode() == 200) {
                try (java.io.InputStream inputStream = connection.getInputStream();
                        java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream()) {

                    byte[] buffer = new byte[4096];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }

                    byte[] imageBytes = outputStream.toByteArray();
                    String contentType = connection.getContentType();
                    if (contentType == null) {
                        contentType = "image/png";
                    }

                    String base64 = java.util.Base64.getEncoder().encodeToString(imageBytes);
                    return "data:" + contentType + ";base64," + base64;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to convert image URL to base64: {}", imageUrl, e);
        }
        return null;
    }

    /**
     * Upload invoice PDF to AWS S3 and return file ID
     */
    private String uploadInvoiceToS3(byte[] pdfBytes, String invoiceNumber, String instituteId) {
        try {
            String fileName = "invoice_" + invoiceNumber + ".pdf";
            MultipartFile multipartFile = new InMemoryMultipartFile(
                    fileName,
                    fileName,
                    "application/pdf",
                    pdfBytes);

            FileDetailsDTO fileDetails = mediaService.uploadFileV2(multipartFile);
            if (fileDetails != null && fileDetails.getId() != null) {
                log.debug("Invoice PDF uploaded to S3. File ID: {}, URL: {}",
                        fileDetails.getId(), fileDetails.getUrl());
                return fileDetails.getId();
            } else {
                throw new VacademyException("Failed to upload invoice PDF to S3");
            }
        } catch (Exception e) {
            log.error("Error uploading invoice PDF to S3", e);
            throw new VacademyException("Failed to upload invoice PDF: " + e.getMessage());
        }
    }

    /**
     * Save invoice to database with multiple payment logs
     */
    private Invoice saveInvoiceWithMultiplePaymentLogs(InvoiceData invoiceData, String invoiceNumber, String pdfFileId,
            List<PaymentLog> paymentLogs, String instituteId) {
        try {
            if (paymentLogs == null || paymentLogs.isEmpty()) {
                throw new VacademyException("Payment logs list cannot be empty");
            }

            PaymentLog firstPaymentLog = paymentLogs.get(0);

            Invoice invoice = new Invoice();
            invoice.setInvoiceNumber(invoiceNumber);
            invoice.setUserId(firstPaymentLog.getUserId());
            invoice.setInstituteId(instituteId);
            invoice.setInvoiceDate(invoiceData.getInvoiceDate());
            invoice.setDueDate(invoiceData.getDueDate());
            invoice.setSubtotal(invoiceData.getSubtotal());
            invoice.setDiscountAmount(invoiceData.getDiscountAmount());
            invoice.setTaxAmount(invoiceData.getTaxAmount());
            invoice.setTotalAmount(invoiceData.getTotalAmount());
            invoice.setCurrency(invoiceData.getCurrency());
            invoice.setStatus(INVOICE_STATUS_GENERATED);
            invoice.setPdfFileId(pdfFileId);
            invoice.setTaxIncluded(invoiceData.getTaxIncluded());

            // Save invoice data as JSON
            try {
                ObjectMapper objectMapper = new ObjectMapper();
                invoice.setInvoiceDataJson(objectMapper.writeValueAsString(invoiceData));
            } catch (Exception e) {
                log.warn("Failed to serialize invoice data to JSON", e);
            }

            invoice = invoiceRepository.save(invoice);

            // Save payment log mappings
            for (PaymentLog paymentLog : paymentLogs) {
                InvoicePaymentLogMapping mapping = new InvoicePaymentLogMapping();
                mapping.setInvoice(invoice);
                mapping.setPaymentLog(paymentLog);
                invoicePaymentLogMappingRepository.save(mapping);
                log.debug("Saved payment log mapping: {} -> {}", paymentLog.getId(), invoiceNumber);
            }

            // Save line items
            if (invoiceData.getLineItems() != null) {
                for (InvoiceLineItemData itemData : invoiceData.getLineItems()) {
                    InvoiceLineItem lineItem = new InvoiceLineItem();
                    lineItem.setInvoice(invoice);
                    lineItem.setItemType(itemData.getItemType());
                    lineItem.setDescription(itemData.getDescription());
                    lineItem.setQuantity(itemData.getQuantity());
                    lineItem.setUnitPrice(itemData.getUnitPrice());
                    lineItem.setAmount(itemData.getAmount());
                    lineItem.setSourceId(itemData.getSourceId());
                    invoiceLineItemRepository.save(lineItem);
                }
            }

            log.debug("Invoice saved to database: {} with {} payment logs", invoiceNumber, paymentLogs.size());
            return invoice;

        } catch (Exception e) {
            log.error("Error saving invoice to database", e);
            throw new VacademyException("Failed to save invoice: " + e.getMessage());
        }
    }

    /**
     * Save invoice to database (legacy method for single payment log)
     * 
     * @deprecated Use saveInvoiceWithMultiplePaymentLogs instead
     */
    @Deprecated
    private Invoice saveInvoice(InvoiceData invoiceData, String invoiceNumber, String pdfFileId,
            UserPlan userPlan, PaymentLog paymentLog, String instituteId) {
        try {
            Invoice invoice = new Invoice();
            invoice.setInvoiceNumber(invoiceNumber);
            invoice.setUserId(paymentLog.getUserId());

            // Create payment log mapping for single payment log (legacy support)
            InvoicePaymentLogMapping mapping = new InvoicePaymentLogMapping();
            mapping.setInvoice(invoice);
            mapping.setPaymentLog(paymentLog);
            invoice.setInstituteId(instituteId);
            invoice.setInvoiceDate(invoiceData.getInvoiceDate());
            invoice.setDueDate(invoiceData.getDueDate());
            invoice.setSubtotal(invoiceData.getSubtotal());
            invoice.setDiscountAmount(invoiceData.getDiscountAmount());
            invoice.setTaxAmount(invoiceData.getTaxAmount());
            invoice.setTotalAmount(invoiceData.getTotalAmount());
            invoice.setCurrency(invoiceData.getCurrency());
            invoice.setStatus(INVOICE_STATUS_GENERATED);
            invoice.setPdfFileId(pdfFileId);
            invoice.setTaxIncluded(invoiceData.getTaxIncluded());

            // Save invoice data as JSON
            try {
                ObjectMapper objectMapper = new ObjectMapper();
                invoice.setInvoiceDataJson(objectMapper.writeValueAsString(invoiceData));
            } catch (Exception e) {
                log.warn("Failed to serialize invoice data to JSON", e);
            }

            invoice = invoiceRepository.save(invoice);

            // Save payment log mapping
            mapping.setInvoice(invoice);
            invoicePaymentLogMappingRepository.save(mapping);

            // Save line items
            if (invoiceData.getLineItems() != null) {
                for (InvoiceLineItemData itemData : invoiceData.getLineItems()) {
                    InvoiceLineItem lineItem = new InvoiceLineItem();
                    lineItem.setInvoice(invoice);
                    lineItem.setItemType(itemData.getItemType());
                    lineItem.setDescription(itemData.getDescription());
                    lineItem.setQuantity(itemData.getQuantity());
                    lineItem.setUnitPrice(itemData.getUnitPrice());
                    lineItem.setAmount(itemData.getAmount());
                    lineItem.setSourceId(itemData.getSourceId());
                    invoiceLineItemRepository.save(lineItem);
                }
            }

            log.debug("Invoice saved to database: {}", invoiceNumber);
            return invoice;

        } catch (Exception e) {
            log.error("Error saving invoice to database", e);
            throw new VacademyException("Failed to save invoice: " + e.getMessage());
        }
    }

    /** 3-arg overload for callers that do not have PDF bytes (e.g. test endpoints); uses link in body. */
    private void sendInvoiceEmail(Invoice invoice, UserDTO user, String instituteId) {
        sendInvoiceEmail(invoice, user, instituteId, null);
    }

    /**
     * Send invoice email to learner if institute setting sendInvoiceEmail is on.
     * When pdfBytes is provided, attaches the PDF to the email; otherwise includes a download link in the body.
     */
    private void sendInvoiceEmail(Invoice invoice, UserDTO user, String instituteId, byte[] pdfBytes) {
        try {
            if (user == null || !StringUtils.hasText(user.getEmail())) {
                log.warn("Cannot send invoice email: user or email is null for invoice: {}", invoice.getInvoiceNumber());
                return;
            }
            Institute institute = instituteRepository.findById(instituteId).orElse(null);
            if (institute == null) {
                log.warn("Institute not found for invoice email: {}", instituteId);
                return;
            }
            Map<String, Object> invoiceSettings = getInvoiceSettings(institute);
            Object sendFlag = invoiceSettings.get("sendInvoiceEmail");
            boolean sendInvoiceEmail = Boolean.TRUE.equals(sendFlag);
            if (!sendInvoiceEmail) {
                log.debug("Invoice email disabled by institute setting for institute: {}", instituteId);
                return;
            }

            String subject = "Your Invoice " + invoice.getInvoiceNumber();
            String body;
            boolean attachPdf = pdfBytes != null && pdfBytes.length > 0;

            // First: try INVOICE_EMAIL type templates (created via easy-email editor)
            // Uses most recently created template for the institute
            var invoiceEmailTemplates = templateService.getTemplatesByInstituteAndType(instituteId, "INVOICE_EMAIL");
            var invoiceEmailTemplate = invoiceEmailTemplates.isEmpty()
                    ? Optional.<vacademy.io.admin_core_service.features.institute.dto.template.TemplateResponse>empty()
                    : Optional.of(invoiceEmailTemplates.get(0));

            // Fallback: legacy EMAIL type with name "Invoice Email"
            if (invoiceEmailTemplate.isEmpty()) {
                var emailTemplates = templateService.getTemplatesByInstituteAndType(instituteId, "EMAIL");
                invoiceEmailTemplate = emailTemplates.stream()
                        .filter(t -> "Invoice Email".equals(t.getName()))
                        .findFirst();
            }

            if (invoiceEmailTemplate.isPresent()) {
                subject = invoiceEmailTemplate.get().getSubject() != null ? invoiceEmailTemplate.get().getSubject() : subject;
                body = invoiceEmailTemplate.get().getContent() != null ? invoiceEmailTemplate.get().getContent() : buildDefaultInvoiceEmailBody(invoice, user, instituteId, attachPdf);
            } else {
                body = buildDefaultInvoiceEmailBody(invoice, user, instituteId, attachPdf);
            }

            String learnerName = user.getFullName() != null ? user.getFullName() : user.getEmail();
            String invoiceNumber = invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : "";
            String totalAmount = invoice.getTotalAmount() != null ? invoice.getTotalAmount().toPlainString() : "0.00";
            String pdfLinkOrAttachText = attachPdf ? "Please find your invoice attached to this email." : (StringUtils.hasText(invoice.getPdfFileId()) ? mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId()) : "");

            // Replace all supported placeholders (both new and legacy)
            body = body.replace("{{invoice_number}}", invoiceNumber)
                    .replace("{{user_name}}", learnerName)
                    .replace("{{learner_name}}", learnerName)
                    .replace("{{total_amount}}", totalAmount)
                    .replace("{{invoice_pdf_link}}", pdfLinkOrAttachText);
            subject = subject.replace("{{invoice_number}}", invoiceNumber)
                    .replace("{{user_name}}", learnerName)
                    .replace("{{learner_name}}", learnerName);

            // Institute placeholders (name/address/contact) — the email template can use
            // {{institute_name}} etc., which the body-replace above did not cover.
            try {
                Institute emailInstitute = instituteRepository.findById(instituteId).orElse(null);
                if (emailInstitute != null) {
                    String instName = emailInstitute.getInstituteName() != null ? emailInstitute.getInstituteName() : "";
                    String instAddr = emailInstitute.getAddress() != null ? emailInstitute.getAddress() : "";
                    String instContact = emailInstitute.getMobileNumber() != null ? emailInstitute.getMobileNumber()
                            : (emailInstitute.getEmail() != null ? emailInstitute.getEmail() : "");
                    body = body.replace("{{institute_name}}", instName)
                            .replace("{{institute_address}}", instAddr)
                            .replace("{{institute_contact}}", instContact);
                    subject = subject.replace("{{institute_name}}", instName);
                }
            } catch (Exception e) {
                log.warn("Could not resolve institute placeholders for invoice email (institute {}): {}",
                        instituteId, e.getMessage());
            }

            if (attachPdf) {
                String attachmentName = "invoice_" + (invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : invoice.getId()) + ".pdf";
                AttachmentUsersDTO.AttachmentDTO attachmentDTO = new AttachmentUsersDTO.AttachmentDTO();
                attachmentDTO.setAttachmentName(attachmentName);
                attachmentDTO.setAttachment(Base64.getEncoder().encodeToString(pdfBytes));

                AttachmentUsersDTO toUser = new AttachmentUsersDTO();
                toUser.setChannelId(user.getEmail());
                toUser.setUserId(user.getId());
                toUser.setPlaceholders(Map.of("email", user.getEmail()));
                toUser.setAttachments(List.of(attachmentDTO));

                java.util.List<AttachmentUsersDTO> recipients = new java.util.ArrayList<>();
                recipients.add(toUser);
                billingContactRecipientResolver
                        .buildBillingContactAttachmentRecipient(user.getId(), instituteId, user.getEmail(), List.of(attachmentDTO))
                        .ifPresent(recipients::add);
                recipients.addAll(invoiceAdminCopyRecipientResolver.buildAdminCopyAttachmentRecipients(
                        instituteId,
                        recipients.stream().map(AttachmentUsersDTO::getChannelId).collect(Collectors.toSet()),
                        List.of(attachmentDTO)));

                AttachmentNotificationDTO attachmentDto = AttachmentNotificationDTO.builder()
                        .body(body)
                        .subject(subject)
                        .notificationType("EMAIL")
                        .source("INVOICE")
                        .sourceId(invoice.getId())
                        .users(recipients)
                        .build();

                notificationService.sendAttachmentEmailViaUnified(List.of(attachmentDto), instituteId);
                log.info("Invoice email sent to {} recipient(s) for invoice: {} (PDF attached)", recipients.size(), invoice.getInvoiceNumber());
            } else {
                NotificationDTO notificationDTO = new NotificationDTO();
                notificationDTO.setBody(body);
                notificationDTO.setSubject(subject);
                notificationDTO.setNotificationType("EMAIL");
                notificationDTO.setSource("INVOICE");
                notificationDTO.setSourceId(invoice.getId());
                NotificationToUserDTO toUser = new NotificationToUserDTO();
                toUser.setChannelId(user.getEmail());
                toUser.setUserId(user.getId());
                toUser.setPlaceholders(Map.of("email", user.getEmail()));

                java.util.List<NotificationToUserDTO> recipients = new java.util.ArrayList<>();
                recipients.add(toUser);
                billingContactRecipientResolver
                        .buildBillingContactRecipient(user.getId(), instituteId, user.getEmail())
                        .ifPresent(recipients::add);
                recipients.addAll(invoiceAdminCopyRecipientResolver.buildAdminCopyRecipients(
                        instituteId,
                        recipients.stream().map(NotificationToUserDTO::getChannelId).collect(Collectors.toSet())));
                notificationDTO.setUsers(recipients);

                notificationService.sendEmailViaUnified(notificationDTO, instituteId);
                log.info("Invoice email sent to {} recipient(s) for invoice: {} (link in body)", recipients.size(), invoice.getInvoiceNumber());
            }
        } catch (Exception e) {
            log.error("Error sending invoice email", e);
            // Don't throw - email failure shouldn't fail invoice generation
        }
    }

    private String buildDefaultInvoiceEmailBody(Invoice invoice, UserDTO user, String instituteId, boolean pdfAttached) {
        if (pdfAttached) {
            return "<p>Dear " + (user.getFullName() != null ? user.getFullName() : user.getEmail()) + ",</p>"
                    + "<p>Please find your invoice " + (invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : "") + " attached to this email.</p>"
                    + "<p>Thank you.</p>";
        }
        String pdfUrl = StringUtils.hasText(invoice.getPdfFileId())
                ? mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId())
                : "";
        return "<p>Dear " + (user.getFullName() != null ? user.getFullName() : user.getEmail()) + ",</p>"
                + "<p>Please find your invoice " + (invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : "") + ".</p>"
                + (StringUtils.hasText(pdfUrl) ? "<p>Download your invoice: <a href=\"" + pdfUrl + "\">" + pdfUrl + "</a></p>" : "")
                + "<p>Thank you.</p>";
    }

    /**
     * Get invoice by ID
     */
    public InvoiceDTO getInvoiceById(String invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        return mapToDTO(invoice);
    }

    /**
     * Get invoices by user ID.
     *
     * <p>After the V224 CPO unification, this also union-merges every UNPAID
     * StudentFeePayment row for the user into the response, mapped to InvoiceDTO
     * so the existing Learner Profile → Payment History panel surfaces pending
     * CPO installments alongside paid invoices in a single list — no contract
     * change for the frontend.
     *
     * <p>Paid CPO installments are NOT mirrored from SFP rows (they already exist
     * as real Invoice rows generated by {@code PaymentLogService} on PAID payment
     * webhooks).
     */
    public List<InvoiceDTO> getInvoicesByUserId(String userId) {
        return getInvoicesByUserId(userId, null);
    }

    public List<InvoiceDTO> getInvoicesByUserId(String userId, String instituteId) {
        List<Invoice> invoices = StringUtils.hasText(instituteId)
                ? invoiceRepository.findByUserIdAndInstituteIdOrderByCreatedAtDesc(userId, instituteId)
                : invoiceRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<InvoiceDTO> result = invoices.stream().map(this::mapToDTO).collect(Collectors.toList());

        // Synthetic per-installment rows. Dedupe vs real-Invoice rows already in
        // `result` by invoice id — buildSfpInvoiceDTOs now writes the real Invoice's
        // id onto its synthetic DTO when one exists, so we must avoid emitting both
        // the real-Invoice row AND the synthetic-with-real-id row for the same id.
        // The synthetic row is preferred because it carries the per-installment
        // status/due-date the admin actually wants to see in this listing.
        java.util.Set<String> realInvoiceIds = new java.util.HashSet<>();
        for (InvoiceDTO existing : result) {
            if (existing.getId() != null) realInvoiceIds.add(existing.getId());
        }
        List<InvoiceDTO> sfpRows = buildSfpInvoiceDTOs(userId);
        java.util.Set<String> sfpRowsTakingOverRealId = new java.util.HashSet<>();
        for (InvoiceDTO sfpRow : sfpRows) {
            String id = sfpRow.getId();
            if (id != null && !id.startsWith("sfp:") && realInvoiceIds.contains(id)) {
                sfpRowsTakingOverRealId.add(id);
            }
        }
        if (!sfpRowsTakingOverRealId.isEmpty()) {
            result.removeIf(r -> r.getId() != null && sfpRowsTakingOverRealId.contains(r.getId()));
        }
        result.addAll(sfpRows);

        // Sort: invoices with a due_date first by due_date asc, then created_at desc.
        result.sort((a, b) -> {
            LocalDateTime ad = a.getDueDate();
            LocalDateTime bd = b.getDueDate();
            if (ad != null && bd != null) return ad.compareTo(bd);
            if (ad != null) return -1;
            if (bd != null) return 1;
            LocalDateTime ac = a.getCreatedAt();
            LocalDateTime bc = b.getCreatedAt();
            if (ac == null && bc == null) return 0;
            if (ac == null) return 1;
            if (bc == null) return -1;
            return bc.compareTo(ac);
        });
        return result;
    }

    /**
     * Synthesizes one virtual InvoiceDTO per StudentFeePayment row so the
     * payment-history tab can render every installment regardless of payment
     * state. Earlier this method only emitted unpaid rows ("DUE-*") because
     * paid installments were assumed to have a real Invoice row generated by
     * the webhook. That assumption breaks for offline-payment + dev
     * environments where PDF/S3 upload may fail and no real Invoice row gets
     * persisted — leaving paid installments invisible in the listing.
     *
     * <p>Status-prefixed invoice numbers ("PAID-*", "PARTIAL-*", "DUE-*",
     * "WAIVED-*", "OVERDUE-*") let the frontend distinguish the synthetic
     * entries from real Invoice rows. Skips DELETED rows.
     */
    private List<InvoiceDTO> buildSfpInvoiceDTOs(String userId) {
        List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserId(userId);

        // Pre-build a sfpId → (realInvoiceId, pdfFileId, pdfUrl) lookup so each
        // synthetic row exposes the actual Invoice it corresponds to. Once the real
        // invoice id is on the DTO, the frontend hits the canonical
        // /v1/invoices/{invoiceId}/download endpoint — same path the manage-students
        // payment-history surface uses. The endpoint regenerates the PDF on the fly
        // when the persisted Invoice has no fileId (the dev-S3-fail case), so a
        // missing fileId at this point is fine — we still surface the real id.
        //
        // Path: SFP → StudentFeeAllocationLedger (latest by createdAt) → PaymentLog
        //       → InvoicePaymentLogMapping → Invoice. We pick the MOST RECENT
        // allocation per SFP because a partial payment can produce multiple ledger
        // rows over time; the latest one corresponds to the invoice the admin wants.
        Map<String, String[]> sfpIdToPdfInfo = new HashMap<>();
        try {
            List<String> sfpIds = sfps.stream()
                    .map(StudentFeePayment::getId)
                    .filter(s -> s != null && !s.isBlank())
                    .collect(Collectors.toList());
            if (!sfpIds.isEmpty()) {
                List<vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger> ledgers =
                        studentFeeAllocationLedgerRepository
                                .findByStudentFeePaymentIdInOrderByCreatedAtDesc(sfpIds);
                Map<String, String> sfpIdToPaymentLogId = new HashMap<>();
                for (var ledger : ledgers) {
                    // findByStudentFeePaymentIdInOrderByCreatedAtDesc is sorted desc, so
                    // putIfAbsent keeps the most-recent PaymentLog per SFP.
                    sfpIdToPaymentLogId.putIfAbsent(
                            ledger.getStudentFeePaymentId(), ledger.getPaymentLogId());
                }
                for (Map.Entry<String, String> e : sfpIdToPaymentLogId.entrySet()) {
                    invoicePaymentLogMappingRepository
                            .findFirstByPaymentLogId(e.getValue())
                            .ifPresent(mapping -> {
                                Invoice inv = mapping.getInvoice();
                                if (inv == null) return;
                                String realInvoiceId = inv.getId();
                                String pdfFileId = inv.getPdfFileId();
                                String url = StringUtils.hasText(pdfFileId)
                                        ? mediaService.getFilePublicUrlById(pdfFileId)
                                        : null;
                                sfpIdToPdfInfo.put(e.getKey(),
                                        new String[]{realInvoiceId, pdfFileId, url});
                            });
                }
            }
        } catch (Exception e) {
            log.warn("Could not enrich SFP DTOs with invoice PDFs for user {}: {}", userId, e.getMessage());
        }
        List<InvoiceDTO> dtos = new ArrayList<>();
        for (StudentFeePayment sfp : sfps) {
            String status = sfp.getStatus();
            if (status == null || "DELETED".equalsIgnoreCase(status)) continue;

            BigDecimal expected = sfp.getAmountExpected() != null ? sfp.getAmountExpected() : BigDecimal.ZERO;
            BigDecimal paid = sfp.getAmountPaid() != null ? sfp.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal outstanding = expected.subtract(paid);

            // Amount column meaning differs by status — admins reading the row
            // want different numbers in each case:
            //   PAID         → receipt for what was actually collected
            //   PARTIAL_PAID → balance still owed (so they can see what's left)
            //   PENDING/DUE  → full bill (the obligation)
            //   OVERDUE      → balance still owed (with overdue flag)
            //   WAIVED       → zero (writeoff)
            BigDecimal displayAmount;
            switch (status.toUpperCase()) {
                case "PAID":         displayAmount = paid; break;
                case "PARTIAL_PAID": displayAmount = outstanding.signum() > 0 ? outstanding : expected; break;
                case "OVERDUE":      displayAmount = outstanding.signum() > 0 ? outstanding : expected; break;
                case "WAIVED":       displayAmount = BigDecimal.ZERO; break;
                default:             displayAmount = expected;
            }

            LocalDateTime dueDate = sfp.getDueDate() != null
                    ? sfp.getDueDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime()
                    : null;
            LocalDateTime createdAt = sfp.getCreatedAt();
            String prefix = invoiceNumberPrefixForStatus(status);

            String[] pdfInfo = sfpIdToPdfInfo.get(sfp.getId());
            String realInvoiceId = pdfInfo != null ? pdfInfo[0] : null;
            String pdfFileId = pdfInfo != null ? pdfInfo[1] : null;
            String pdfUrl = pdfInfo != null ? pdfInfo[2] : null;
            // When a real Invoice exists for this SFP, expose its id so the FE's
            // existing /v1/invoices/{id}/download path can resolve (and regenerate
            // if needed) the PDF without a per-SFP endpoint. Otherwise fall back to
            // the synthetic "sfp:..." marker so the row remains uniquely-keyed.
            String dtoId = StringUtils.hasText(realInvoiceId) ? realInvoiceId : ("sfp:" + sfp.getId());
            dtos.add(InvoiceDTO.builder()
                    .id(dtoId)
                    .invoiceNumber(prefix + "-" + sfp.getId())
                    .userId(sfp.getUserId())
                    .userPlanId(sfp.getUserPlanId())
                    .instituteId(sfp.getInstituteId())
                    // invoiceDate = the SFP's due date so the listing's "Date"
                    // column matches the installment due date by default.
                    // Falls back to the row's createdAt if no due date was set.
                    .invoiceDate(dueDate != null ? dueDate : createdAt)
                    .dueDate(dueDate)
                    .subtotal(displayAmount)
                    .totalAmount(displayAmount)
                    .currency("INR")
                    .status(mapSfpStatusToInvoiceStatus(status))
                    .createdAt(createdAt)
                    .updatedAt(sfp.getUpdatedAt())
                    .pdfFileId(pdfFileId)
                    .pdfUrl(pdfUrl)
                    .lineItems(java.util.Collections.emptyList())
                    .build());
        }
        return dtos;
    }

    private String invoiceNumberPrefixForStatus(String sfpStatus) {
        if (sfpStatus == null) return "DUE";
        switch (sfpStatus.toUpperCase()) {
            case "PAID":         return "PAID";
            case "PARTIAL_PAID": return "PARTIAL";
            case "OVERDUE":      return "OVERDUE";
            case "WAIVED":       return "WAIVED";
            case "PENDING":
            default:             return "DUE";
        }
    }

    private String mapSfpStatusToInvoiceStatus(String sfpStatus) {
        if (sfpStatus == null) return "PENDING";
        switch (sfpStatus.toUpperCase()) {
            case "PAID":         return "PAID";
            case "PARTIAL_PAID": return "PARTIAL";
            case "OVERDUE":      return "OVERDUE";
            case "WAIVED":       return "WAIVED";
            case "PENDING":
            default:             return "UNPAID";
        }
    }

    /**
     * Get invoices by institute ID with optional filters and pagination.
     */
    public Page<InvoiceDTO> getInvoicesByInstituteId(
            String instituteId, String userId, String status,
            LocalDateTime startDate, LocalDateTime endDate,
            int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Invoice> invoicePage = invoiceRepository.findByInstituteIdWithFilters(
                instituteId, userId, status, startDate, endDate, pageable);
        return invoicePage.map(this::mapToDTO);
    }

    /**
     * Test method: Manually trigger invoice generation for testing purposes
     * This method will group related payment logs (same vendor_id or time window)
     * into one invoice
     * This method is useful for testing invoice generation without going through
     * the full payment flow
     */
    public String testGenerateInvoice(String paymentLogId) {
        try {
            PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                    .orElseThrow(() -> new VacademyException("Payment log not found: " + paymentLogId));

            if (paymentLog.getUserPlan() == null) {
                throw new VacademyException("Payment log has no associated user plan");
            }

            if (paymentLog.getPaymentStatus() == null || !paymentLog.getPaymentStatus().equals("PAID")) {
                throw new VacademyException("Payment log status must be PAID. Current status: " +
                        paymentLog.getPaymentStatus());
            }

            // Get institute ID from user plan
            String instituteId = paymentLog.getUserPlan().getEnrollInvite() != null
                    ? paymentLog.getUserPlan().getEnrollInvite().getInstituteId()
                    : null;

            if (instituteId == null) {
                throw new VacademyException("Could not determine institute ID from payment log");
            }

            log.info("Test: Manually generating invoice for payment log: {} (will group related logs)", paymentLogId);
            Invoice invoice = generateInvoice(
                    paymentLog.getUserPlan(),
                    paymentLog,
                    instituteId);

            String pdfUrl = invoice.getPdfFileId() != null
                    ? mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId())
                    : null;
            return "Invoice generated successfully! Invoice Number: " + invoice.getInvoiceNumber() +
                    ", PDF File ID: " + invoice.getPdfFileId() +
                    (pdfUrl != null ? ", PDF URL: " + pdfUrl : "") +
                    ", Payment Logs: " + invoice.getPaymentLogMappings().size();
        } catch (Exception e) {
            log.error("Test: Failed to generate invoice for payment log: {}", paymentLogId, e);
            throw new VacademyException("Failed to generate invoice: " + e.getMessage());
        }
    }

    /**
     * Test method: Generate invoice for MULTI-PACKAGE enrollment (v2 API)
     * This method simulates the v2 API scenario where multiple payment logs have
     * the same order ID
     * and should be grouped into a single invoice with multiple line items
     */
    @Transactional
    public String testGenerateInvoiceForMultiPackage(String orderId) {
        try {
            log.info("Test: Generating invoice for multi-package enrollment with order ID: {}", orderId);

            // Find all payment logs with the same order ID
            List<PaymentLog> paymentLogs = paymentLogRepository.findAllByOrderIdInOriginalRequest(orderId);

            if (paymentLogs.isEmpty()) {
                return "No payment logs found with order ID: " + orderId;
            }

            // Filter to only PAID logs that aren't already invoiced
            List<PaymentLog> eligibleLogs = paymentLogs.stream()
                    .filter(log -> "PAID".equals(log.getPaymentStatus()))
                    .filter(log -> !invoicePaymentLogMappingRepository.existsByPaymentLogId(log.getId()))
                    .collect(Collectors.toList());

            if (eligibleLogs.isEmpty()) {
                return "No eligible payment logs found (must be PAID and not already invoiced) for order ID: "
                        + orderId;
            }

            log.info("Found {} eligible payment logs for multi-package invoice", eligibleLogs.size());

            // Use the first payment log to get institute and user info
            PaymentLog firstPaymentLog = eligibleLogs.get(0);

            if (firstPaymentLog.getUserPlan() == null) {
                throw new VacademyException("Payment log has no associated user plan");
            }

            // Get institute ID from user plan
            String instituteId = firstPaymentLog.getUserPlan().getEnrollInvite() != null
                    ? firstPaymentLog.getUserPlan().getEnrollInvite().getInstituteId()
                    : null;

            if (instituteId == null) {
                throw new VacademyException("Could not determine institute ID from payment log");
            }

            // Build invoice data from multiple payment logs
            InvoiceData invoiceData = buildInvoiceDataFromMultiplePaymentLogs(eligibleLogs, instituteId);

            // Generate invoice number
            String invoiceNumber = generateInvoiceNumber(instituteId);
            invoiceData.setInvoiceNumber(invoiceNumber);

            // Load template
            String templateHtml = loadInvoiceTemplate(instituteId);

            // Replace placeholders
            String filledTemplate = replaceTemplatePlaceholders(templateHtml, invoiceData);

            // Generate PDF
            byte[] pdfBytes = generatePdfFromHtml(filledTemplate);

            // Upload to S3
            String pdfFileId = uploadInvoiceToS3(pdfBytes, invoiceNumber, instituteId);

            // Save invoice
            Invoice invoice = saveInvoiceWithMultiplePaymentLogs(invoiceData, invoiceNumber, pdfFileId,
                    eligibleLogs, instituteId);

            // Send email
            try {
                sendInvoiceEmail(invoice, invoiceData.getUser(), instituteId, pdfBytes);
            } catch (Exception e) {
                log.error(
                        "Failed to send invoice email for multi-package invoice: {}. Invoice generation will continue.",
                        invoiceNumber, e);
            }

            String pdfUrl = invoice.getPdfFileId() != null
                    ? mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId())
                    : null;
            return "Multi-package invoice generated successfully! Invoice Number: " + invoice.getInvoiceNumber() +
                    ", PDF File ID: " + invoice.getPdfFileId() + ", Package Sessions: " + eligibleLogs.size() +
                    (pdfUrl != null ? ", PDF URL: " + pdfUrl : "");
        } catch (Exception e) {
            log.error("Test: Failed to generate multi-package invoice for order ID: {}", orderId, e);
            throw new VacademyException("Failed to generate multi-package invoice: " + e.getMessage());
        }
    }

    /**
     * Test method: Generate invoice for a SINGLE payment log only (no grouping)
     * This bypasses the grouping logic and creates an invoice for just this one
     * payment log
     * Useful for testing single payment log scenarios without worrying about
     * related logs
     */
    @Transactional
    public String testGenerateInvoiceSingle(String paymentLogId) {
        try {
            PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                    .orElseThrow(() -> new VacademyException("Payment log not found: " + paymentLogId));

            if (paymentLog.getUserPlan() == null) {
                throw new VacademyException("Payment log has no associated user plan");
            }

            if (paymentLog.getPaymentStatus() == null || !paymentLog.getPaymentStatus().equals("PAID")) {
                throw new VacademyException("Payment log status must be PAID. Current status: " +
                        paymentLog.getPaymentStatus());
            }

            // Check if already invoiced
            if (invoicePaymentLogMappingRepository.existsByPaymentLogId(paymentLog.getId())) {
                Invoice existingInvoice = findInvoiceByPaymentLogId(paymentLog.getId());
                String pdfUrl = existingInvoice.getPdfFileId() != null
                        ? mediaService.getFileUrlById(existingInvoice.getPdfFileId())
                        : null;
                return "Payment log is already invoiced! Invoice Number: " + existingInvoice.getInvoiceNumber() +
                        ", PDF File ID: " + existingInvoice.getPdfFileId() +
                        (pdfUrl != null ? ", PDF URL: " + pdfUrl : "");
            }

            // Get institute ID from user plan
            String instituteId = paymentLog.getUserPlan().getEnrollInvite() != null
                    ? paymentLog.getUserPlan().getEnrollInvite().getInstituteId()
                    : null;

            if (instituteId == null) {
                throw new VacademyException("Could not determine institute ID from payment log");
            }

            log.info("Test: Generating invoice for SINGLE payment log only: {} (no grouping)", paymentLogId);

            // Build invoice data from ONLY this payment log (no grouping)
            InvoiceData invoiceData = buildInvoiceDataFromMultiplePaymentLogs(
                    List.of(paymentLog), // Only this one payment log
                    instituteId);

            // Generate invoice number and set it in invoice data
            String invoiceNumber = generateInvoiceNumber(instituteId);
            invoiceData.setInvoiceNumber(invoiceNumber);

            // Load template
            String templateHtml = loadInvoiceTemplate(instituteId);

            // Replace placeholders
            String filledTemplate = replaceTemplatePlaceholders(templateHtml, invoiceData);

            // Generate PDF
            byte[] pdfBytes = generatePdfFromHtml(filledTemplate);

            // Upload to S3 and get file ID
            String pdfFileId = uploadInvoiceToS3(pdfBytes, invoiceNumber, instituteId);

            // Save invoice with only this payment log
            Invoice invoice = saveInvoiceWithMultiplePaymentLogs(
                    invoiceData,
                    invoiceNumber,
                    pdfFileId,
                    List.of(paymentLog), // Only this one payment log
                    instituteId);

            // Send email (async)
            try {
                sendInvoiceEmail(invoice, invoiceData.getUser(), instituteId, pdfBytes);
            } catch (Exception e) {
                log.error("Failed to send invoice email for invoice: {}. Invoice generation will continue.",
                        invoiceNumber, e);
            }

            String pdfUrl = invoice.getPdfFileId() != null
                    ? mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId())
                    : null;
            return "Invoice generated successfully for SINGLE payment log! Invoice Number: " +
                    invoice.getInvoiceNumber() + ", PDF File ID: " + invoice.getPdfFileId() +
                    (pdfUrl != null ? ", PDF URL: " + pdfUrl : "");
        } catch (Exception e) {
            log.error("Test: Failed to generate invoice for single payment log: {}", paymentLogId, e);
            throw new VacademyException("Failed to generate invoice: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin-created invoice: create, pay, and mark paid
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Admin creates one invoice per userId in the request (bulk or single).
     * No UserPlan or PackageSession required — line items are free-form.
     */
    @Transactional
    public List<AdminInvoicePaymentLinkResponseDTO> createAdminInvoices(AdminCreateInvoiceRequestDTO request) {
        List<AdminInvoicePaymentLinkResponseDTO> results = new ArrayList<>();

        Institute institute = instituteRepository.findById(request.getInstituteId())
                .orElseThrow(() -> new VacademyException("Institute not found: " + request.getInstituteId()));

        // Read institute invoice settings once for all users in this bulk request
        Map<String, Object> invoiceSettings = getInvoiceSettings(institute);

        // Subtotal = sum of (unitPrice * quantity) from line items
        BigDecimal subtotal = request.getLineItems().stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Tax: institute settings by default, overridable per-invoice via
        // request.taxEnabled/taxRatePercent (e.g. remove tax or use a one-off rate).
        EffectiveTax effectiveTax = computeEffectiveTax(invoiceSettings, subtotal,
                request.getTaxEnabled(), request.getTaxRatePercent());
        boolean taxIncluded = effectiveTax.taxIncluded();
        BigDecimal taxRate = effectiveTax.taxRate();
        String taxLabel = effectiveTax.taxLabel();
        BigDecimal taxAmount = effectiveTax.taxAmount();
        BigDecimal totalAmount = effectiveTax.totalAmount();

        // Per-invoice text overrides (invoice_number, party & institute details, tax label…).
        // User-scoped keys are stripped for bulk so they don't bleed across users.
        boolean singleUser = request.getUserIds().size() == 1;
        Map<String, String> baseOverrides = sanitizeOverrides(request.getOverrides(), singleUser);
        Map<String, String> currentInstituteProfile = invoiceInstituteProfileService.loadAsMap(invoiceSettings);
        // Notes: an explicit override (even "") means the admin deliberately set/cleared it —
        // never overridden by a fallback. Only absent falls through to request.notes, then the
        // institute's remembered default notes.
        String effectiveNotes = baseOverrides.containsKey("notes")
                ? baseOverrides.get("notes")
                : firstNonBlank(request.getNotes(), currentInstituteProfile.get("notes"));
        // Invoice date: admin-chosen or now.
        LocalDateTime invoiceDate = request.getInvoiceDate() != null ? request.getInvoiceDate() : LocalDateTime.now();

        // Remember institute-linked details for next time (any admin, any future invoice) —
        // institute-wide, so done once per request regardless of bulk/single. Only genuine
        // deviations are persisted (see instituteEditsFromOverrides); own transaction, so a
        // settings-save failure can never break invoice creation.
        try {
            Map<String, String> instituteEdits =
                    instituteEditsFromOverrides(baseOverrides, institute, currentInstituteProfile);
            invoiceInstituteProfileService.upsert(institute, invoiceSettings, instituteEdits);
        } catch (Exception e) {
            log.warn("Failed to persist institute invoice profile for institute {}: {}",
                    request.getInstituteId(), e.getMessage());
        }

        for (String userId : request.getUserIds()) {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
            if (users.isEmpty()) {
                log.warn("User not found for ID: {}, skipping invoice creation", userId);
                continue;
            }
            UserDTO user = users.get(0);

            // Per-user render overrides: start from the base set, then drop invoice_number
            // (the number is authoritative on the Invoice row / invoiceData, never a text
            // override) and fold in the resolved notes so they render escaped.
            Map<String, String> renderOverrides = new HashMap<>(baseOverrides);
            renderOverrides.remove("invoice_number");
            if (StringUtils.hasText(effectiveNotes)) {
                renderOverrides.put("notes", effectiveNotes);
            }

            // Invoice number: honour a unique admin override, else auto-generate.
            String invoiceNumber;
            String overrideNumber = baseOverrides.get("invoice_number");
            if (StringUtils.hasText(overrideNumber)
                    && invoiceRepository.findByInvoiceNumber(overrideNumber.trim()).isEmpty()) {
                invoiceNumber = overrideNumber.trim();
            } else {
                if (StringUtils.hasText(overrideNumber)) {
                    log.warn("Overridden invoice number '{}' already exists — generating a fresh number instead",
                            overrideNumber);
                }
                invoiceNumber = generateInvoiceNumber(request.getInstituteId());
            }

            Invoice invoice = new Invoice();
            invoice.setInvoiceNumber(invoiceNumber);
            invoice.setUserId(userId);
            invoice.setInstituteId(request.getInstituteId());
            invoice.setInvoiceDate(invoiceDate);
            invoice.setDueDate(request.getDueDate());
            invoice.setSubtotal(subtotal);
            invoice.setDiscountAmount(BigDecimal.ZERO);
            invoice.setTaxAmount(taxAmount);
            invoice.setTotalAmount(totalAmount);
            invoice.setCurrency(request.getCurrency());
            invoice.setStatus(INVOICE_STATUS_PENDING_PAYMENT);
            invoice.setTaxIncluded(taxIncluded);

            // Persist notes + overrides so a later PDF regeneration reproduces the admin's edits.
            try {
                Map<String, Object> dataJson = new HashMap<>();
                if (StringUtils.hasText(effectiveNotes)) dataJson.put("notes", effectiveNotes);
                if (!renderOverrides.isEmpty()) dataJson.put("overrides", renderOverrides);
                if (!dataJson.isEmpty()) {
                    invoice.setInvoiceDataJson(INVOICE_JSON_MAPPER.writeValueAsString(dataJson));
                }
            } catch (Exception ignored) {}

            invoice = invoiceRepository.save(invoice);

            // Save line items
            for (AdminInvoiceLineItemRequestDTO itemReq : request.getLineItems()) {
                BigDecimal lineAmount = itemReq.getUnitPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
                InvoiceLineItem lineItem = new InvoiceLineItem();
                lineItem.setInvoice(invoice);
                lineItem.setItemType(StringUtils.hasText(itemReq.getItemType()) ? itemReq.getItemType() : "SERVICE");
                lineItem.setDescription(itemReq.getDescription());
                lineItem.setQuantity(itemReq.getQuantity());
                lineItem.setUnitPrice(itemReq.getUnitPrice());
                lineItem.setAmount(lineAmount);
                invoiceLineItemRepository.save(lineItem);
            }

            // Remember the user-linked Bill-To details for next time (single-user only; for bulk
            // the user-scoped keys were stripped, so there is nothing per-user to save). Only
            // fields the admin actually CHANGED from the live user record are persisted, so an
            // unchanged field keeps tracking the record. Runs in its own transaction (REQUIRES_NEW);
            // catch so a profile failure never breaks invoice creation.
            if (singleUser) {
                try {
                    Map<String, String> currentBp =
                            invoiceBillingProfileService.loadAsMap(userId, request.getInstituteId());
                    invoiceBillingProfileService.upsert(userId, request.getInstituteId(),
                            billingEditsFromOverrides(renderOverrides, user, currentBp));
                } catch (Exception e) {
                    log.warn("Failed to persist invoice billing profile for user {}: {}",
                            userId, e.getMessage());
                }
            }

            // Generate PDF immediately so the admin can share it
            String pdfFileId = null;
            try {
                pdfFileId = generateAndUploadAdminInvoicePdf(invoice, user, institute,
                        request.getLineItems(), subtotal, taxAmount, totalAmount,
                        request.getCurrency(), taxIncluded, taxRate, taxLabel,
                        effectiveNotes, renderOverrides);
                invoice.setPdfFileId(pdfFileId);
                invoice = invoiceRepository.save(invoice);
            } catch (Exception e) {
                log.error("Failed to generate PDF for admin invoice {}: {}", invoiceNumber, e.getMessage(), e);
            }

            String pdfUrl = pdfFileId != null ? mediaService.getFilePublicUrlByIdWithoutExpiry(pdfFileId) : null;
            String paymentLink = buildPaymentLink(institute, invoice.getId());

            // Notify the learner via in-app system alert
            try {
                String amountStr = request.getCurrency() + " " + totalAmount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
                String alertTitle = "New Invoice: " + amountStr;
                String alertBody = "You have a new invoice (" + invoiceNumber + ") of " + amountStr
                        + " due by " + (request.getDueDate() != null ? request.getDueDate().toLocalDate().toString() : "N/A")
                        + ". Tap to pay: " + paymentLink;
                notificationService.createSystemAlertAnnouncement(
                        request.getInstituteId(),
                        List.of(userId),
                        alertTitle,
                        alertBody,
                        "system",
                        institute.getInstituteName() != null ? institute.getInstituteName() : "Institute",
                        "ADMIN",
                        Map.of("priority", 3, "isDismissible", true, "showBadge", true, "isActive", true));
            } catch (Exception e) {
                log.warn("Failed to send invoice system alert to user {}: {}", userId, e.getMessage());
            }

            results.add(AdminInvoicePaymentLinkResponseDTO.builder()
                    .invoiceId(invoice.getId())
                    .invoiceNumber(invoiceNumber)
                    .userId(userId)
                    .totalAmount(totalAmount)
                    .currency(request.getCurrency())
                    .status(INVOICE_STATUS_PENDING_PAYMENT)
                    .dueDate(request.getDueDate())
                    .paymentLink(paymentLink)
                    .pdfUrl(pdfUrl)
                    .build());
        }

        return results;
    }

    /**
     * Records a manual / offline payment against a PENDING_PAYMENT admin invoice.
     * Mirrors the CPO side-view recordOfflinePayment flow but binds to an Invoice
     * instead of a UserPlan — the resulting PaymentLog has {@code userPlan=null}
     * because admin invoices aren't tied to an enrollment.
     *
     * <p>End state: PaymentLog (vendor=MANUAL, status=SUCCESS, paymentStatus=PAID)
     * + InvoicePaymentLogMapping + invoice.status=PAID. Email is best-effort —
     * logged on failure, not rethrown.
     */
    @Transactional
    public InvoiceDTO markInvoicePaidManually(
            String invoiceId,
            vacademy.io.admin_core_service.features.invoice.dto.ManualInvoicePaymentRequestDTO request,
            CustomUserDetails userDetails) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        if (!INVOICE_STATUS_PENDING_PAYMENT.equalsIgnoreCase(invoice.getStatus())) {
            throw new VacademyException("Invoice is not pending payment (status="
                    + invoice.getStatus() + ")");
        }

        String currency = StringUtils.hasText(invoice.getCurrency()) ? invoice.getCurrency() : "INR";
        double amount = invoice.getTotalAmount() != null
                ? invoice.getTotalAmount().doubleValue() : 0d;

        // 1. PaymentLog — userPlan=null because admin invoices aren't bound to enrollments.
        String paymentLogId = paymentLogService.createPaymentLog(
                invoice.getUserId(),
                amount,
                vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                vacademy.io.common.payment.enums.PaymentGateway.MANUAL.name(),
                currency,
                null,
                null,
                new java.util.Date());

        // 2. Promote to SUCCESS/PAID + audit metadata
        Map<String, Object> paymentSpecificData = new HashMap<>();
        if (request != null && StringUtils.hasText(request.getTransactionId())) {
            paymentSpecificData.put("transaction_id", request.getTransactionId());
        }
        if (request != null && StringUtils.hasText(request.getNotes())) {
            paymentSpecificData.put("notes", request.getNotes());
        }
        paymentSpecificData.put("source", "ADMIN_INVOICE_MANUAL");
        paymentSpecificData.put("invoice_id", invoiceId);
        if (userDetails != null && StringUtils.hasText(userDetails.getUserId())) {
            paymentSpecificData.put("recorded_by", userDetails.getUserId());
        }
        try {
            paymentLogService.updatePaymentLogOnly(
                    paymentLogId,
                    vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum.SUCCESS.name(),
                    vacademy.io.common.payment.enums.PaymentStatusEnum.PAID.name(),
                    new ObjectMapper().writeValueAsString(paymentSpecificData));
        } catch (Exception e) {
            throw new VacademyException("Failed to promote payment log to SUCCESS: " + e.getMessage());
        }

        // 3. Link PaymentLog → Invoice + flip status to PAID
        PaymentLog persistedLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new VacademyException(
                        "Payment log not found after creation: " + paymentLogId));
        InvoicePaymentLogMapping mapping = new InvoicePaymentLogMapping();
        mapping.setInvoice(invoice);
        mapping.setPaymentLog(persistedLog);
        invoicePaymentLogMappingRepository.save(mapping);

        invoice.setStatus("PAID");
        invoice = invoiceRepository.save(invoice);

        // 4. Best-effort confirmation email — logged-on-fail per the design doc.
        try {
            UserDTO user = authService.getUsersFromAuthServiceByUserIds(
                    List.of(invoice.getUserId())).stream().findFirst().orElse(null);
            if (user != null) {
                Institute institute = instituteRepository.findById(invoice.getInstituteId())
                        .orElse(null);
                if (institute != null) {
                    byte[] pdfBytes = StringUtils.hasText(invoice.getPdfFileId())
                            ? fetchPdfBytesFromS3(invoice.getPdfFileId()) : null;
                    sendInvoiceEmail(invoice, user, institute.getId(), pdfBytes);
                }
            }
        } catch (Exception e) {
            log.warn("Manual-payment confirmation email failed for invoice {}: {}",
                    invoiceId, e.getMessage());
        }

        return mapToDTO(invoice);
    }

    /**
     * Fires a fresh payment-due reminder for a PENDING_PAYMENT admin invoice. Re-uses
     * the same email + in-app alert path the create flow uses, with the same payment
     * link the learner already has. Safe to call repeatedly — no DB state mutation,
     * just notifications.
     *
     * <p>Both the email (gated by INVOICE_SETTING.sendInvoiceEmail) and the in-app
     * alert are best-effort: failures are logged and the call still returns 200 with
     * whichever channels succeeded so the FE can give precise feedback to the admin.
     */
    @Transactional
    public Map<String, Object> sendInvoiceReminder(String invoiceId, CustomUserDetails userDetails) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        if (!INVOICE_STATUS_PENDING_PAYMENT.equalsIgnoreCase(invoice.getStatus())) {
            throw new VacademyException(
                    "Reminders can only be sent for PENDING_PAYMENT invoices (current status: "
                    + invoice.getStatus() + ")");
        }

        UserDTO user = authService.getUsersFromAuthServiceByUserIds(List.of(invoice.getUserId()))
                .stream().findFirst().orElseThrow(
                        () -> new VacademyException("Invoice user not found: " + invoice.getUserId()));
        Institute institute = instituteRepository.findById(invoice.getInstituteId())
                .orElseThrow(() -> new VacademyException(
                        "Institute not found: " + invoice.getInstituteId()));

        String paymentLink = buildPaymentLink(institute, invoice.getId());
        String currency = StringUtils.hasText(invoice.getCurrency()) ? invoice.getCurrency() : "INR";
        String amountStr = currency + " " + invoice.getTotalAmount()
                .setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();

        boolean emailSent = false;
        boolean alertSent = false;

        // In-app system alert — mirrors what createAdminInvoices fires at creation
        // time, but with a "Reminder:" prefix so the learner sees this is a follow-up
        // rather than a brand-new bill.
        try {
            String dueStr = invoice.getDueDate() != null
                    ? invoice.getDueDate().toLocalDate().toString() : "N/A";
            notificationService.createSystemAlertAnnouncement(
                    invoice.getInstituteId(),
                    List.of(invoice.getUserId()),
                    "Reminder: Invoice " + invoice.getInvoiceNumber() + " · " + amountStr,
                    "Your invoice (" + invoice.getInvoiceNumber() + ") of " + amountStr
                            + " is still pending. Due " + dueStr + ". Tap to pay: " + paymentLink,
                    "system",
                    institute.getInstituteName() != null
                            ? institute.getInstituteName() : "Institute",
                    "ADMIN",
                    Map.of("priority", 3, "isDismissible", true, "showBadge", true, "isActive", true));
            alertSent = true;
        } catch (Exception e) {
            log.warn("In-app alert reminder failed for invoice {}: {}", invoiceId, e.getMessage());
        }

        // Email — gated by INVOICE_SETTING.sendInvoiceEmail (same as create-time send).
        try {
            byte[] pdfBytes = StringUtils.hasText(invoice.getPdfFileId())
                    ? fetchPdfBytesFromS3(invoice.getPdfFileId()) : null;
            sendInvoiceEmail(invoice, user, invoice.getInstituteId(), pdfBytes);
            emailSent = true;
        } catch (Exception e) {
            log.warn("Email reminder failed for invoice {}: {}", invoiceId, e.getMessage());
        }

        log.info("[InvoiceReminder] invoiceId={} email_sent={} alert_sent={} triggered_by={}",
                invoiceId, emailSent, alertSent,
                userDetails != null ? userDetails.getUserId() : "system");

        Map<String, Object> out = new HashMap<>();
        out.put("invoice_id", invoiceId);
        out.put("invoice_number", invoice.getInvoiceNumber());
        out.put("recipient_email", user.getEmail());
        out.put("email_sent", emailSent);
        out.put("alert_sent", alertSent);
        out.put("payment_link", paymentLink);
        return out;
    }

    /**
     * Voids a mistaken PENDING_PAYMENT admin invoice: flips status to REJECTED so its
     * payment link stops working and it can never be marked paid, while keeping the row
     * (and PDF) around for record-keeping. Terminal — a REJECTED invoice cannot be
     * un-rejected; the admin creates a corrected invoice instead (see "Duplicate" on the
     * frontend, which prefills a new Create-Invoice dialog from this one's line items).
     *
     * <p>Only PENDING_PAYMENT invoices can be rejected — an already-PAID invoice
     * represents money that actually moved and must be handled as a refund/credit
     * instead, not silently voided.
     */
    @Transactional
    public InvoiceDTO rejectInvoice(String invoiceId, String instituteId, String reason,
            CustomUserDetails userDetails) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        if (instituteId != null && !instituteId.equals(invoice.getInstituteId())) {
            throw new VacademyException("Invoice does not belong to this institute");
        }
        if (!INVOICE_STATUS_PENDING_PAYMENT.equalsIgnoreCase(invoice.getStatus())) {
            throw new VacademyException("Only a PENDING_PAYMENT invoice can be rejected (current status: "
                    + invoice.getStatus() + ")");
        }

        invoice.setStatus(INVOICE_STATUS_REJECTED);
        // Audit trail: who voided it and when is always recorded — reason is merely optional
        // free text on top of that, not a gate on capturing the actor/timestamp.
        Map<String, Object> rejectAudit = new HashMap<>();
        rejectAudit.put("rejectedBy", userDetails != null ? userDetails.getUserId() : "system");
        rejectAudit.put("rejectedAt", LocalDateTime.now().toString());
        if (StringUtils.hasText(reason)) {
            rejectAudit.put("rejectReason", reason);
        }
        invoice.setInvoiceDataJson(mergeInvoiceDataJson(invoice.getInvoiceDataJson(), rejectAudit));
        invoice = invoiceRepository.save(invoice);

        log.info("[InvoiceReject] invoiceId={} invoiceNumber={} rejectedBy={} reason={}",
                invoiceId, invoice.getInvoiceNumber(),
                userDetails != null ? userDetails.getUserId() : "system", reason);

        return mapToDTO(invoice);
    }

    /**
     * Merge additional keys into the invoice's {@code invoice_data_json} blob without
     * clobbering whatever is already there (e.g. persisted notes/overrides from create
     * time) — read-modify-write over the same JSON object shape {@code applyStoredOverrides}
     * expects. Best-effort: returns the original JSON unchanged if parsing fails.
     */
    @SuppressWarnings("unchecked")
    private String mergeInvoiceDataJson(String existingJson, Map<String, Object> additions) {
        try {
            Map<String, Object> merged = StringUtils.hasText(existingJson)
                    ? new HashMap<>(INVOICE_JSON_MAPPER.readValue(existingJson, Map.class))
                    : new HashMap<>();
            merged.putAll(additions);
            return INVOICE_JSON_MAPPER.writeValueAsString(merged);
        } catch (Exception e) {
            log.warn("Failed to merge invoice_data_json, leaving unchanged: {}", e.getMessage());
            return existingJson;
        }
    }

    /** Read a single string field out of {@code invoice_data_json}, or null if absent/unparseable. */
    @SuppressWarnings("unchecked")
    private String readInvoiceDataJsonField(String json, String key) {
        if (!StringUtils.hasText(json)) return null;
        try {
            Map<String, Object> parsed = INVOICE_JSON_MAPPER.readValue(json, Map.class);
            Object value = parsed.get(key);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Initiates gateway payment for an admin-created invoice.
     * Creates PaymentLog (userPlan=null) and links it to the invoice.
     */
    @Transactional
    public PaymentResponseDTO initiatePaymentForAdminInvoice(String invoiceId, String instituteId,
            CustomUserDetails userDetails) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));

        if (!invoice.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Invoice does not belong to this institute");
        }
        if (!INVOICE_STATUS_PENDING_PAYMENT.equalsIgnoreCase(invoice.getStatus())) {
            throw new VacademyException("This invoice is " + invoice.getStatus()
                    + " and can no longer be paid");
        }

        // Get institute's configured gateway
        InstitutePaymentGatewayMappingService.VendorInfo vendorInfo =
                institutePaymentGatewayMappingService.getLatestVendorInfoForInstitute(instituteId);

        PaymentInitiationRequestDTO paymentRequest = new PaymentInitiationRequestDTO();
        paymentRequest.setAmount(invoice.getTotalAmount().doubleValue());
        paymentRequest.setCurrency(invoice.getCurrency());
        paymentRequest.setVendor(vendorInfo.getVendor());
        paymentRequest.setVendorId(vendorInfo.getVendorId());
        paymentRequest.setInstituteId(instituteId);
        paymentRequest.setDescription("Admin Invoice " + invoice.getInvoiceNumber());

        // Fetch full UserDTO for gateway customer creation
        String userId = invoice.getUserId();
        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(userId));
        if (users.isEmpty()) {
            throw new VacademyException("User not found: " + userId);
        }
        UserDTO user = users.get(0);
        if (StringUtils.hasText(user.getEmail())) {
            paymentRequest.setEmail(user.getEmail());
        }

        // Create PaymentLog with userPlan=null
        String paymentLogId = createAdminInvoicePaymentLog(userId, invoice.getTotalAmount().doubleValue(),
                vendorInfo.getVendor(), vendorInfo.getVendorId(), invoice.getCurrency());

        paymentRequest.setOrderId(paymentLogId);

        // Link PaymentLog → Invoice
        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new VacademyException("PaymentLog not found after creation"));
        InvoicePaymentLogMapping mapping = new InvoicePaymentLogMapping();
        mapping.setInvoice(invoice);
        mapping.setPaymentLog(paymentLog);
        invoicePaymentLogMappingRepository.save(mapping);

        // Call gateway
        PaymentResponseDTO response = paymentService.makePayment(
                vendorInfo.getVendor(), instituteId, user, paymentRequest);

        // Update PaymentLog with gateway response
        Map<String, Object> logData = new HashMap<>();
        logData.put("response", response);
        logData.put("originalRequest", paymentRequest);
        String paymentStatus = response.getResponseData() != null
                ? (String) response.getResponseData().get("paymentStatus")
                : null;
        if (!StringUtils.hasText(paymentStatus)) {
            paymentStatus = "PAYMENT_PENDING";
        }
        paymentLog.setStatus("ACTIVE");
        paymentLog.setPaymentStatus(paymentStatus);
        try {
            paymentLog.setPaymentSpecificData(new ObjectMapper().writeValueAsString(logData));
        } catch (Exception ignored) {}
        paymentLogRepository.save(paymentLog);

        response.setOrderId(paymentLogId);
        return response;
    }

    /**
     * Called by webhook handlers when a PaymentLog with no UserPlan (admin invoice)
     * is marked as PAID. Updates the linked invoice status and sends email.
     */
    @Transactional
    public void markAdminInvoicePaidByPaymentLog(String paymentLogId, String instituteId) {
        InvoicePaymentLogMapping mapping = invoicePaymentLogMappingRepository
                .findFirstByPaymentLogId(paymentLogId).orElse(null);
        if (mapping == null) {
            log.info("No admin invoice found for paymentLogId={}, skipping markAdminInvoicePaid", paymentLogId);
            return;
        }

        // Load the invoice directly (not via lazy proxy) so Hibernate tracks it as a
        // managed entity in the current persistence context before we mutate its status.
        String invoiceId = mapping.getInvoice().getId();
        Invoice invoice = invoiceRepository.findById(invoiceId).orElse(null);
        if (invoice == null) {
            log.warn("Invoice {} not found for paymentLogId={}, skipping", invoiceId, paymentLogId);
            return;
        }
        if (INVOICE_STATUS_PAID.equals(invoice.getStatus())) {
            log.info("Invoice {} already marked as PAID, skipping", invoice.getId());
            return;
        }
        if (INVOICE_STATUS_REJECTED.equals(invoice.getStatus())) {
            // The admin voided this invoice — a late/retried gateway webhook must never
            // resurrect it to PAID. Reject is terminal; this is the single point where money
            // is actually recognized for admin invoices, so the guard belongs here.
            log.warn("Ignoring PAID webhook for REJECTED invoice {} (paymentLogId={}) — invoice was voided",
                    invoice.getId(), paymentLogId);
            return;
        }

        invoice.setStatus(INVOICE_STATUS_PAID);
        invoiceRepository.saveAndFlush(invoice);
        log.info("Admin invoice {} marked as PAID via paymentLogId={}", invoice.getInvoiceNumber(), paymentLogId);

        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(invoice.getUserId()));
            if (!users.isEmpty()) {
                byte[] pdfBytes = invoice.getPdfFileId() != null
                        ? fetchPdfBytesFromS3(invoice.getPdfFileId())
                        : null;
                sendInvoiceEmail(invoice, users.get(0), instituteId, pdfBytes);
            }
        } catch (Exception e) {
            log.error("Failed to send paid invoice email for invoice {}: {}", invoice.getId(), e.getMessage(), e);
        }
    }

    private String createAdminInvoicePaymentLog(String userId, double amount, String vendor, String vendorId,
            String currency) {
        PaymentLog log = new PaymentLog();
        log.setStatus("INITIATED");
        log.setPaymentAmount(amount);
        log.setUserId(userId);
        log.setPaymentStatus(null);
        log.setVendor(vendor);
        log.setVendorId(vendorId);
        log.setDate(new java.util.Date());
        log.setCurrency(currency);
        log.setUserPlan(null);
        return paymentLogRepository.save(log).getId();
    }

    private String generateAndUploadAdminInvoicePdf(Invoice invoice, UserDTO user, Institute institute,
            List<AdminInvoiceLineItemRequestDTO> lineItems,
            BigDecimal subtotal, BigDecimal taxAmount, BigDecimal totalAmount,
            String currency, Boolean taxIncluded, BigDecimal taxRate, String taxLabel,
            String notes, Map<String, String> overrides) {
        List<InvoiceLineItemData> lineItemData =
                buildAdminLineItemData(lineItems, taxAmount, taxIncluded, taxRate, taxLabel);

        InvoiceData invoiceData = InvoiceData.builder()
                .user(user)
                .institute(institute)
                .invoiceNumber(invoice.getInvoiceNumber())
                .invoiceDate(invoice.getInvoiceDate())
                .dueDate(invoice.getDueDate())
                .subtotal(subtotal)
                .discountAmount(BigDecimal.ZERO)
                .taxAmount(taxAmount)
                .totalAmount(totalAmount)
                .currency(currency)
                .taxIncluded(taxIncluded)
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod("")
                .transactionId("")
                .paymentDate(LocalDateTime.now())
                .lineItems(lineItemData)
                .notes(notes)
                .overrides(overrides)
                .build();

        String templateHtml = loadInvoiceTemplate(institute.getId());
        String filled = replaceTemplatePlaceholders(templateHtml, invoiceData);
        byte[] pdfBytes = generatePdfFromHtml(filled);
        return uploadInvoiceToS3(pdfBytes, invoice.getInvoiceNumber(), institute.getId());
    }

    /**
     * Build the template line-item list for an admin invoice: one row per request item,
     * plus a synthetic TAX row when the institute charges tax exclusively (so the table
     * visibly shows the tax the totals include). Shared by create + preview so both render
     * identically.
     */
    /** Effective per-invoice tax outcome — see {@link #computeEffectiveTax}. */
    private record EffectiveTax(
            boolean taxIncluded, BigDecimal taxRate, String taxLabel,
            BigDecimal taxAmount, BigDecimal totalAmount) {}

    /**
     * Resolve the tax actually applied to ONE admin invoice: institute settings are the
     * default, but the request can override the rate or turn tax off entirely for just
     * this invoice. Shared by {@link #createAdminInvoices} and {@link #previewAdminInvoice}
     * so the rendered preview and the created invoice can never disagree on the math.
     *
     * @param requestTaxEnabled null/true = apply tax (rate below); false = no tax at all —
     *                          total_amount == subtotal, taxAmount = 0.
     * @param requestTaxRatePercent null = use the institute's INVOICE_SETTING taxRate;
     *                          otherwise this percentage (e.g. 18 for 18%) is used instead.
     */
    private EffectiveTax computeEffectiveTax(Map<String, Object> invoiceSettings, BigDecimal subtotal,
            Boolean requestTaxEnabled, BigDecimal requestTaxRatePercent) {
        String taxLabel = invoiceSettings.get("taxLabel") != null
                ? invoiceSettings.get("taxLabel").toString() : "Tax";

        if (Boolean.FALSE.equals(requestTaxEnabled)) {
            // Tax removed entirely for this invoice — taxRate=null (not ZERO) so
            // replaceTemplatePlaceholders blanks {{tax_rate}}, and label is blank too, so a
            // template with a fixed "Tax ({{tax_rate}}%)" row doesn't print "Tax (0%)" on an
            // invoice that has no tax section at all.
            return new EffectiveTax(false, null, "", BigDecimal.ZERO, subtotal);
        }

        boolean taxIncluded = Boolean.TRUE.equals(invoiceSettings.get("taxIncluded"));
        BigDecimal ratePercent = requestTaxRatePercent != null
                ? requestTaxRatePercent
                : BigDecimal.valueOf(invoiceSettings.get("taxRate") != null
                        ? ((Number) invoiceSettings.get("taxRate")).doubleValue() : 0.0);
        BigDecimal taxRate = ratePercent.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);

        BigDecimal taxAmount;
        BigDecimal totalAmount;
        if (taxIncluded) {
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            BigDecimal netSubtotal = subtotal.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = subtotal.subtract(netSubtotal);
            totalAmount = subtotal;
        } else {
            taxAmount = subtotal.multiply(taxRate).setScale(2, RoundingMode.HALF_UP);
            totalAmount = subtotal.add(taxAmount);
        }
        return new EffectiveTax(taxIncluded, taxRate, taxLabel, taxAmount, totalAmount);
    }

    private List<InvoiceLineItemData> buildAdminLineItemData(List<AdminInvoiceLineItemRequestDTO> lineItems,
            BigDecimal taxAmount, Boolean taxIncluded, BigDecimal taxRate, String taxLabel) {
        List<InvoiceLineItemData> lineItemData = lineItems.stream()
                .map(item -> InvoiceLineItemData.builder()
                        .itemType(StringUtils.hasText(item.getItemType()) ? item.getItemType() : "SERVICE")
                        .description(item.getDescription())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .amount(item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                        .build())
                .collect(Collectors.toList());

        if (taxAmount != null && taxAmount.compareTo(BigDecimal.ZERO) > 0
                && !Boolean.TRUE.equals(taxIncluded)) {
            lineItemData.add(InvoiceLineItemData.builder()
                    .itemType("TAX")
                    .description(buildTaxLineDescription(taxLabel, taxRate))
                    .quantity(1)
                    .unitPrice(taxAmount)
                    .amount(taxAmount)
                    .build());
        }
        return lineItemData;
    }

    private String buildTaxLineDescription(String taxLabel, BigDecimal taxRate) {
        // formatRate trims to a whole number when the rate IS whole (e.g. "18"), but keeps
        // decimals otherwise (e.g. "12.5") — rounding to 0dp here would print "Tax @ 13%" for a
        // 12.5% override while the line's actual amount is computed at 12.5%.
        BigDecimal ratePct = (taxRate != null ? taxRate : BigDecimal.ZERO).multiply(BigDecimal.valueOf(100));
        return (StringUtils.hasText(taxLabel) ? taxLabel : "Tax") + " @ " + formatRate(ratePct) + "%";
    }

    /**
     * Keep only whitelisted, non-blank-key overrides. Drops any non-editable key
     * (amounts, HTML blocks, dates) and — for bulk requests — user-scoped keys. This is
     * the trust boundary: only these keys can carry admin text into the template.
     */
    private Map<String, String> sanitizeOverrides(Map<String, String> raw, boolean singleUser) {
        Map<String, String> out = new HashMap<>();
        if (raw == null || raw.isEmpty()) return out;
        for (Map.Entry<String, String> e : raw.entrySet()) {
            String key = e.getKey();
            if (key == null || !EDITABLE_OVERRIDE_KEYS.contains(key)) continue;
            if (!singleUser && USER_SCOPED_OVERRIDE_KEYS.contains(key)) continue;
            out.put(key, e.getValue() != null ? e.getValue() : "");
        }
        return out;
    }

    private String nz(String s) {
        return s != null ? s : "";
    }

    /** First non-blank value, or "" if all are blank. */
    private String firstNonBlank(String... values) {
        if (values != null) {
            for (String v : values) {
                if (StringUtils.hasText(v)) return v;
            }
        }
        return "";
    }

    /**
     * From the submitted overrides, keep only the user-linked Bill-To fields that GENUINELY
     * DEVIATE from what the admin was actually shown (any previously-saved pin, else the live
     * user record). The FE always sends the fully-seeded override map whether or not the admin
     * touched anything, so this comparison is what makes the "remember" feature correct — see
     * {@link #addDeviationEdit}.
     */
    private Map<String, String> billingEditsFromOverrides(Map<String, String> overrides, UserDTO user,
            Map<String, String> currentBp) {
        Map<String, String> edits = new HashMap<>();
        if (overrides == null || user == null) return edits;
        addDeviationEdit(edits, overrides, "user_name", user.getFullName(), currentBp.get("user_name"));
        addDeviationEdit(edits, overrides, "user_email", user.getEmail(), currentBp.get("user_email"));
        addDeviationEdit(edits, overrides, "user_address", user.getAddressLine(), currentBp.get("user_address"));
        addDeviationEdit(edits, overrides, "user_tax_info", "", currentBp.get("user_tax_info")); // no record source
        addDeviationEdit(edits, overrides, "place_of_supply", user.getRegion(), currentBp.get("place_of_supply"));
        return edits;
    }

    /**
     * From the submitted overrides, keep only the institute-linked fields (institute_name,
     * institute_address, institute_contact, notes) that genuinely DEVIATE from what the admin
     * was actually shown — mirrors {@link #billingEditsFromOverrides}. Notes have no external
     * "record" to compare against (raw baseline ""), so they reduce to "differs from the
     * previously-saved default" — {@link #addDeviationEdit} handles that uniformly.
     */
    private Map<String, String> instituteEditsFromOverrides(Map<String, String> overrides, Institute institute,
            Map<String, String> currentIp) {
        Map<String, String> edits = new HashMap<>();
        if (overrides == null || institute == null) return edits;
        addDeviationEdit(edits, overrides, "institute_name", institute.getInstituteName(),
                currentIp.get("institute_name"));
        addDeviationEdit(edits, overrides, "institute_address", institute.getAddress(),
                currentIp.get("institute_address"));
        addDeviationEdit(edits, overrides, "institute_contact",
                firstNonBlank(institute.getMobileNumber(), institute.getEmail()),
                currentIp.get("institute_contact"));
        addDeviationEdit(edits, overrides, "notes", "", currentIp.get("notes"));
        return edits;
    }

    /**
     * Decide whether to persist a deviation for one "remembered default" field, given what the
     * admin submitted, the RAW source-of-truth baseline (the user/institute record — {@code ""}
     * when no such record exists, e.g. notes), and any CURRENTLY-PINNED override that was
     * actually shown as the default this time.
     *
     * <ul>
     *   <li>Key absent from {@code overrides} → the template didn't surface it → leave storage
     *       untouched (don't wipe a value saved via a different template).
     *   <li>Submitted matches what was actually SHOWN (the pin if one exists, else the raw
     *       record) → the admin didn't change anything → no-op. This is the fix for a real bug:
     *       comparing only against the raw record (ignoring an existing pin) makes "pin matches
     *       what's shown" look identical to "matches the record," so re-submitting an
     *       already-corrected, unedited value would silently DELETE the correction on every
     *       subsequent invoice.
     *   <li>Submitted matches the RAW record (and differs from the pin) → the admin explicitly
     *       reverted to the record → clear the pin ({@code ""}).
     *   <li>Otherwise → a genuinely new value → pin it.
     * </ul>
     */
    private void addDeviationEdit(Map<String, String> edits, Map<String, String> overrides,
            String key, String rawBaseline, String currentPin) {
        if (!overrides.containsKey(key)) return;
        String submitted = overrides.get(key);
        String shown = firstNonBlank(currentPin, rawBaseline);
        if (nz(submitted).trim().equals(nz(shown).trim())) return; // unchanged from what was shown
        edits.put(key, nz(submitted).trim().equals(nz(rawBaseline).trim()) ? "" : submitted);
    }

    /**
     * Renders a non-persisting preview of an admin invoice: fills the institute's
     * template with the request's line items + any overrides, and returns the rendered
     * HTML plus the resolved value of every editable placeholder the template uses.
     * Consumes no invoice number and writes nothing.
     */
    public AdminInvoicePreviewResponseDTO previewAdminInvoice(AdminCreateInvoiceRequestDTO request) {
        Institute institute = instituteRepository.findById(request.getInstituteId())
                .orElseThrow(() -> new VacademyException("Institute not found: " + request.getInstituteId()));

        // Billed user = first id in the request (the dialog is single-user). Missing user
        // still previews with blank party fields the admin can fill via overrides.
        UserDTO user = null;
        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(
                    List.of(request.getUserIds().get(0)));
            if (!users.isEmpty()) user = users.get(0);
        }
        if (user == null) user = UserDTO.builder().build();

        // Prefill the user-linked Bill-To fields from the remembered billing profile (if any),
        // so the admin doesn't re-type them for a returning customer.
        String billedUserId = (request.getUserIds() != null && !request.getUserIds().isEmpty())
                ? request.getUserIds().get(0) : null;
        Map<String, String> billingProfile = billedUserId != null
                ? invoiceBillingProfileService.loadAsMap(billedUserId, request.getInstituteId())
                : Collections.emptyMap();

        Map<String, Object> invoiceSettings = getInvoiceSettings(institute);

        BigDecimal subtotal = request.getLineItems().stream()
                .map(item -> item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Same effective-tax resolution createAdminInvoices uses, so the preview's numbers
        // and rendered {{tax_rate}}/{{tax_label}} can never disagree with what create persists.
        EffectiveTax effectiveTax = computeEffectiveTax(invoiceSettings, subtotal,
                request.getTaxEnabled(), request.getTaxRatePercent());
        boolean taxIncluded = effectiveTax.taxIncluded();
        BigDecimal taxRate = effectiveTax.taxRate();
        String taxLabel = effectiveTax.taxLabel();
        BigDecimal taxAmount = effectiveTax.taxAmount();
        BigDecimal totalAmount = effectiveTax.totalAmount();

        boolean singleUser = request.getUserIds() != null && request.getUserIds().size() == 1;
        Map<String, String> userOverrides = sanitizeOverrides(request.getOverrides(), singleUser);
        String effectiveNotes = userOverrides.containsKey("notes")
                ? userOverrides.get("notes")
                : firstNonBlank(request.getNotes(), invoiceInstituteProfileService.loadAsMap(invoiceSettings).get("notes"));

        // Resolve the invoice number exactly like createAdminInvoices: honour a unique admin
        // override, else the freshly generated next number. This keeps the preview's rendered
        // {{invoice_number}} equal to what create will actually assign on a collision.
        String overrideNumber = userOverrides.get("invoice_number");
        String invoiceNumber = (StringUtils.hasText(overrideNumber)
                && invoiceRepository.findByInvoiceNumber(overrideNumber.trim()).isEmpty())
                ? overrideNumber.trim()
                : generateInvoiceNumber(request.getInstituteId());

        InvoiceData invoiceData = InvoiceData.builder()
                .user(user)
                .institute(institute)
                .invoiceNumber(invoiceNumber)
                .invoiceDate(request.getInvoiceDate() != null ? request.getInvoiceDate() : LocalDateTime.now())
                .dueDate(request.getDueDate())
                .subtotal(subtotal)
                .discountAmount(BigDecimal.ZERO)
                .taxAmount(taxAmount)
                .totalAmount(totalAmount)
                .currency(request.getCurrency())
                .taxIncluded(taxIncluded)
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod("")
                .transactionId("")
                .paymentDate(LocalDateTime.now())
                .lineItems(buildAdminLineItemData(request.getLineItems(), taxAmount, taxIncluded, taxRate, taxLabel))
                .notes(effectiveNotes)
                .billingProfile(billingProfile)
                .build();

        // Render EVERY editable placeholder through the escaping override path (defaults merged
        // under the admin's edits) so the preview HTML matches the created PDF byte-for-byte —
        // including the seed frame, where the admin has edited nothing. invoice_number is driven
        // by invoiceData (collision-resolved above), notes are folded in escaped. Mirrors the
        // renderOverrides createAdminInvoices builds.
        Map<String, String> defaults = computeDefaultTextValues(invoiceData, invoiceSettings);
        Map<String, String> renderOverrides = new HashMap<>(userOverrides);
        for (String key : EDITABLE_OVERRIDE_KEYS) {
            if (!renderOverrides.containsKey(key) && defaults.containsKey(key)) {
                renderOverrides.put(key, defaults.get(key));
            }
        }
        renderOverrides.remove("invoice_number");
        if (StringUtils.hasText(effectiveNotes)) renderOverrides.put("notes", effectiveNotes);
        invoiceData.setOverrides(renderOverrides);

        String templateHtml = loadInvoiceTemplate(request.getInstituteId());
        String html = replaceTemplatePlaceholders(templateHtml, invoiceData);
        List<AdminInvoicePreviewResponseDTO.PlaceholderValue> resolved =
                computeResolvedValues(invoiceData, templateHtml, invoiceSettings);

        return AdminInvoicePreviewResponseDTO.builder().html(html).resolvedValues(resolved).build();
    }

    /**
     * For each placeholder the template actually contains (and that we know how to label),
     * produce its current value — the override when supplied, else the auto-derived value.
     * Values are RAW (unescaped) so the UI can seed editable inputs; the preview HTML is
     * separately escaped by {@link #replaceTemplatePlaceholders}.
     */
    private List<AdminInvoicePreviewResponseDTO.PlaceholderValue> computeResolvedValues(
            InvoiceData invoiceData, String templateHtml, Map<String, Object> invoiceSettings) {
        Set<String> present = new HashSet<>();
        java.util.regex.Matcher m = PLACEHOLDER_PATTERN.matcher(templateHtml != null ? templateHtml : "");
        while (m.find()) present.add(m.group(1));

        Map<String, String> defaults = computeDefaultTextValues(invoiceData, invoiceSettings);
        Map<String, String> overrides = invoiceData.getOverrides() != null
                ? invoiceData.getOverrides() : Collections.emptyMap();

        List<AdminInvoicePreviewResponseDTO.PlaceholderValue> out = new ArrayList<>();
        for (Map.Entry<String, PlaceholderMeta> entry : PLACEHOLDER_META.entrySet()) {
            String key = entry.getKey();
            if (!present.contains(key)) continue;
            PlaceholderMeta meta = entry.getValue();
            // invoice_number falls back to the derived (freshly generated) value on preview.
            String value = (meta.editable() && overrides.containsKey(key))
                    ? overrides.get(key) : defaults.getOrDefault(key, "");
            out.add(AdminInvoicePreviewResponseDTO.PlaceholderValue.builder()
                    .key(key)
                    .label(meta.label())
                    .group(meta.group())
                    .editable(meta.editable())
                    .inputType(meta.inputType())
                    .value(value != null ? value : "")
                    .build());
        }
        return out;
    }

    /** Auto-derived (pre-override) value for each editable/derived text placeholder. */
    @SuppressWarnings("unchecked")
    private Map<String, String> computeDefaultTextValues(InvoiceData invoiceData, Map<String, Object> invoiceSettings) {
        Map<String, String> d = new HashMap<>();
        UserDTO user = invoiceData.getUser();
        Institute institute = invoiceData.getInstitute();
        // Remembered billing details (if any) win over the raw user record for the
        // user-linked fields, so a previously-entered Bill-To prefills next time.
        Map<String, String> bp = invoiceData.getBillingProfile() != null
                ? invoiceData.getBillingProfile() : Collections.emptyMap();

        d.put("invoice_number", nz(invoiceData.getInvoiceNumber()));
        d.put("invoice_date", invoiceData.getInvoiceDate() != null
                ? invoiceData.getInvoiceDate().toLocalDate().toString() : "");
        d.put("due_date", invoiceData.getDueDate() != null
                ? invoiceData.getDueDate().toLocalDate().toString() : "");

        d.put("user_name", firstNonBlank(bp.get("user_name"), user != null ? user.getFullName() : null));
        d.put("user_email", firstNonBlank(bp.get("user_email"), user != null ? user.getEmail() : null));
        d.put("user_address", firstNonBlank(bp.get("user_address"), user != null ? user.getAddressLine() : null));
        d.put("place_of_supply", firstNonBlank(bp.get("place_of_supply"), user != null ? user.getRegion() : null));
        d.put("user_tax_info", nz(bp.get("user_tax_info")));

        // Institute-level defaults: a previously-saved override (INVOICE_SETTING) wins over
        // the institute's raw record, so a corrected name/address/contact prefills for every
        // future invoice from any admin — see InvoiceInstituteProfileService.
        Map<String, String> ip = invoiceInstituteProfileService.loadAsMap(invoiceSettings);
        if (institute != null) {
            d.put("institute_name", firstNonBlank(ip.get("institute_name"), institute.getInstituteName()));
            d.put("institute_address", firstNonBlank(ip.get("institute_address"), institute.getAddress()));
            d.put("institute_contact", firstNonBlank(ip.get("institute_contact"),
                    institute.getMobileNumber(), institute.getEmail()));
        }

        // Effective (possibly per-invoice-overridden) tax, not the raw institute default —
        // matches what replaceTemplatePlaceholders renders and what create will persist.
        d.put("tax_label", invoiceData.getTaxLabel() != null ? invoiceData.getTaxLabel() : "Tax");
        d.put("tax_rate", invoiceData.getTaxRate() != null
                ? formatRate(invoiceData.getTaxRate().multiply(BigDecimal.valueOf(100))) : "");
        Object countryObj = invoiceSettings.get("country");
        if (countryObj instanceof Map) {
            Map<String, Object> c = (Map<String, Object>) countryObj;
            d.put("country", c.get("name") != null ? c.get("name").toString() : "");
            d.put("country_code", c.get("code") != null ? c.get("code").toString().toUpperCase() : "");
            d.put("tax_registration_number", c.get("taxRegistrationNumber") != null
                    ? c.get("taxRegistrationNumber").toString() : "");
            d.put("hsn_code", c.get("hsnSacCode") != null ? c.get("hsnSacCode").toString() : "");
        }

        String sym = getCurrencySymbol(invoiceData.getCurrency() != null ? invoiceData.getCurrency() : "INR");
        d.put("subtotal", sym + (invoiceData.getSubtotal() != null ? invoiceData.getSubtotal().toString() : "0.00"));
        d.put("tax_amount", sym + (invoiceData.getTaxAmount() != null ? invoiceData.getTaxAmount().toString() : "0.00"));
        d.put("total_amount", sym + (invoiceData.getTotalAmount() != null ? invoiceData.getTotalAmount().toString() : "0.00"));
        d.put("currency", nz(invoiceData.getCurrency()));
        d.put("notes", nz(invoiceData.getNotes()));
        return d;
    }

    /**
     * Rebuild {@link InvoiceData} for an admin invoice (no payment-log mappings) directly
     * from the persisted row, its line items, and any stored notes/overrides — so the PDF
     * can be regenerated on demand with the admin's edits intact. Returns null if the
     * institute is gone.
     */
    private InvoiceData buildInvoiceDataFromPersistedInvoice(Invoice invoice) {
        Institute institute = instituteRepository.findById(invoice.getInstituteId()).orElse(null);
        if (institute == null) return null;

        UserDTO user;
        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(invoice.getUserId()));
        user = users.isEmpty() ? UserDTO.builder().build() : users.get(0);

        List<InvoiceLineItemData> lineItemData = invoiceLineItemRepository.findByInvoiceId(invoice.getId()).stream()
                .map(li -> InvoiceLineItemData.builder()
                        .itemType(li.getItemType())
                        .description(li.getDescription())
                        .quantity(li.getQuantity())
                        .unitPrice(li.getUnitPrice())
                        .amount(li.getAmount())
                        .build())
                .collect(Collectors.toList());

        Map<String, Object> settings = getInvoiceSettings(institute);
        // Derive the rate from the AMOUNTS ACTUALLY FROZEN on the invoice, not the institute's
        // current settings — this invoice may have used a per-invoice tax override, or the
        // institute's tax rate may have changed since creation. Re-deriving from settings would
        // silently disagree with the persisted subtotal/tax_amount/total on regeneration.
        BigDecimal subtotal = invoice.getSubtotal() != null ? invoice.getSubtotal() : BigDecimal.ZERO;
        BigDecimal taxAmount = invoice.getTaxAmount() != null ? invoice.getTaxAmount() : BigDecimal.ZERO;
        BigDecimal taxRate;
        if (taxAmount.compareTo(BigDecimal.ZERO) <= 0 || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            taxRate = null; // no tax on this invoice — matches computeEffectiveTax's "disabled" convention
        } else if (Boolean.TRUE.equals(invoice.getTaxIncluded())) {
            // taxAmount is the tax embedded within subtotal; rate = tax / (subtotal - tax).
            BigDecimal netSubtotal = subtotal.subtract(taxAmount);
            taxRate = netSubtotal.compareTo(BigDecimal.ZERO) > 0
                    ? taxAmount.divide(netSubtotal, 10, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
        } else {
            taxRate = taxAmount.divide(subtotal, 10, RoundingMode.HALF_UP);
        }
        String taxLabel = taxRate == null ? ""
                : settings.get("taxLabel") != null ? settings.get("taxLabel").toString() : "Tax";

        // Persisted line items don't include the synthetic TAX row (only real items are
        // stored) — re-append it so the regenerated table matches the original PDF.
        if (taxAmount.compareTo(BigDecimal.ZERO) > 0
                && !Boolean.TRUE.equals(invoice.getTaxIncluded())) {
            lineItemData.add(InvoiceLineItemData.builder()
                    .itemType("TAX")
                    .description(buildTaxLineDescription(taxLabel, taxRate))
                    .quantity(1)
                    .unitPrice(taxAmount)
                    .amount(taxAmount)
                    .build());
        }

        InvoiceData data = InvoiceData.builder()
                .user(user)
                .institute(institute)
                .invoiceNumber(invoice.getInvoiceNumber())
                .invoiceDate(invoice.getInvoiceDate())
                .dueDate(invoice.getDueDate())
                .subtotal(invoice.getSubtotal())
                .discountAmount(invoice.getDiscountAmount())
                .taxAmount(invoice.getTaxAmount())
                .totalAmount(invoice.getTotalAmount())
                .currency(invoice.getCurrency())
                .taxIncluded(invoice.getTaxIncluded())
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod("")
                .transactionId("")
                .paymentDate(invoice.getInvoiceDate())
                .lineItems(lineItemData)
                .build();
        applyStoredOverrides(invoice, data);
        return data;
    }

    /** Fold persisted notes + overrides (from invoice_data_json) onto an InvoiceData. */
    @SuppressWarnings("unchecked")
    private void applyStoredOverrides(Invoice invoice, InvoiceData data) {
        if (invoice == null || data == null || !StringUtils.hasText(invoice.getInvoiceDataJson())) return;
        try {
            Map<String, Object> json = INVOICE_JSON_MAPPER.readValue(invoice.getInvoiceDataJson(), Map.class);
            Object notes = json.get("notes");
            if (notes instanceof String && StringUtils.hasText((String) notes)) {
                data.setNotes((String) notes);
            }
            Object ov = json.get("overrides");
            if (ov instanceof Map) {
                Map<String, String> overrides = new HashMap<>();
                ((Map<String, Object>) ov).forEach((k, v) -> {
                    if (k != null && v != null) overrides.put(k.toString(), v.toString());
                });
                data.setOverrides(overrides);
            }
        } catch (Exception e) {
            log.warn("Failed to parse invoice_data_json for invoice {}: {}", invoice.getId(), e.getMessage());
        }
    }

    private byte[] fetchPdfBytesFromS3(String pdfFileId) {
        try {
            String pdfUrl = mediaService.getFilePublicUrlByIdWithoutExpiry(pdfFileId);
            if (!StringUtils.hasText(pdfUrl)) return null;
            java.net.URL url = new java.net.URL(pdfUrl);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(15000);
            if (conn.getResponseCode() == 200) {
                try (java.io.InputStream is = conn.getInputStream();
                     java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
                    return out.toByteArray();
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch PDF bytes for pdfFileId={}: {}", pdfFileId, e.getMessage());
        }
        return null;
    }

    private String buildPaymentLink(Institute institute, String invoiceId) {
        String base = StringUtils.hasText(institute.getLearnerPortalBaseUrl())
                ? institute.getLearnerPortalBaseUrl()
                : learnerPortalUrl;
        if (!base.startsWith("http")) {
            base = "https://" + base;
        }
        return base.replaceAll("/$", "") + invoicePayPath + "/" + invoiceId;
    }

    /**
     * Map Invoice entity to DTO
     */
    /**
     * Only PENDING_PAYMENT admin invoices need a payment link in the listing — paid
     * invoices, refunded, and synthetic SFP-derived rows don't have a learner-facing
     * pay page. Resolves the institute via repo (mapToDTO has only the FK string).
     * Best-effort: returns null on any failure (the FE just hides the Copy Link button).
     */
    private String computePaymentLinkForListing(Invoice invoice) {
        try {
            if (invoice == null) return null;
            if (!INVOICE_STATUS_PENDING_PAYMENT.equalsIgnoreCase(invoice.getStatus())) return null;
            if (!StringUtils.hasText(invoice.getInstituteId())) return null;
            Institute inst = instituteRepository.findById(invoice.getInstituteId()).orElse(null);
            if (inst == null) return null;
            return buildPaymentLink(inst, invoice.getId());
        } catch (Exception e) {
            log.debug("computePaymentLinkForListing failed for invoice {}: {}",
                    invoice != null ? invoice.getId() : null, e.getMessage());
            return null;
        }
    }

    private InvoiceDTO mapToDTO(Invoice invoice) {
        List<InvoiceLineItemDTO> lineItemDTOs = null;
        if (invoice.getLineItems() != null) {
            lineItemDTOs = invoice.getLineItems().stream()
                    .map(item -> InvoiceLineItemDTO.builder()
                            .id(item.getId())
                            .invoiceId(item.getInvoice().getId())
                            .itemType(item.getItemType())
                            .description(item.getDescription())
                            .quantity(item.getQuantity())
                            .unitPrice(item.getUnitPrice())
                            .amount(item.getAmount())
                            .sourceId(item.getSourceId())
                            .build())
                    .collect(Collectors.toList());
        }

        // Get all payment log IDs and user plan ID from mappings
        List<String> paymentLogIds = new ArrayList<>();
        String primaryPaymentLogId = null;
        String userPlanId = null;
        if (invoice.getPaymentLogMappings() != null && !invoice.getPaymentLogMappings().isEmpty()) {
            paymentLogIds = invoice.getPaymentLogMappings().stream()
                    .map(m -> m.getPaymentLog().getId())
                    .collect(Collectors.toList());
            primaryPaymentLogId = paymentLogIds.get(0); // First one as primary

            // Get user plan ID from first payment log (via mapping)
            if (!invoice.getPaymentLogMappings().isEmpty()) {
                PaymentLog firstPaymentLog = invoice.getPaymentLogMappings().get(0).getPaymentLog();
                if (firstPaymentLog.getUserPlan() != null) {
                    userPlanId = firstPaymentLog.getUserPlan().getId();
                }
            }
        }

        return InvoiceDTO.builder()
                .id(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .userPlanId(userPlanId) // Retrieved from payment log via mapping
                .paymentLogId(primaryPaymentLogId) // Primary payment log ID (for backward compatibility)
                .paymentLogIds(paymentLogIds) // All payment log IDs
                .userId(invoice.getUserId())
                .instituteId(invoice.getInstituteId())
                .invoiceDate(invoice.getInvoiceDate())
                .dueDate(invoice.getDueDate())
                .subtotal(invoice.getSubtotal())
                .discountAmount(invoice.getDiscountAmount())
                .taxAmount(invoice.getTaxAmount())
                .totalAmount(invoice.getTotalAmount())
                .currency(invoice.getCurrency())
                .status(invoice.getStatus())
                .pdfFileId(invoice.getPdfFileId())
                .pdfUrl(invoice.getPdfFileId() != null ? mediaService.getFilePublicUrlById(invoice.getPdfFileId()) : null) // Pre-signed URL (1-day expiry)
                                                                                                                     // URL
                                                                                                                     // from
                                                                                                                     // file
                                                                                                                     // ID
                .paymentLink(computePaymentLinkForListing(invoice))
                .taxIncluded(invoice.getTaxIncluded())
                .notes(readInvoiceDataJsonField(invoice.getInvoiceDataJson(), "notes"))
                .createdAt(invoice.getCreatedAt())
                .updatedAt(invoice.getUpdatedAt())
                .lineItems(lineItemDTOs)
                .build();
    }

    public PublicInvoiceListResponse getInvoicesByEmailPublic(String email, String instituteId) {
        String normalizedEmail = email.toLowerCase().trim();
        UserDTO user = authService.getUserByEmail(normalizedEmail);
        log.info("[invoice-by-email] email='{}' resolved userId={}", normalizedEmail,
                user != null ? user.getId() : "null");
        if (user == null || user.getId() == null) {
            return new PublicInvoiceListResponse(normalizedEmail, 0, List.of());
        }
        List<InvoiceDTO> invoices = getInvoicesByUserId(user.getId(), instituteId);
        log.info("[invoice-by-email] userId={} → {} invoice(s)", user.getId(), invoices.size());
        List<PublicInvoiceDTO> publicInvoices = invoices.stream()
                .map(this::toPublicInvoiceDTO)
                .collect(Collectors.toList());
        return new PublicInvoiceListResponse(normalizedEmail, publicInvoices.size(), publicInvoices);
    }

    private PublicInvoiceDTO toPublicInvoiceDTO(InvoiceDTO dto) {
        List<PublicInvoiceLineItemDTO> items = dto.getLineItems() == null ? List.of() :
                dto.getLineItems().stream()
                        .map(li -> PublicInvoiceLineItemDTO.builder()
                                .itemType(li.getItemType())
                                .description(li.getDescription())
                                .quantity(li.getQuantity())
                                .unitPrice(li.getUnitPrice())
                                .amount(li.getAmount())
                                .build())
                        .collect(Collectors.toList());
        return PublicInvoiceDTO.builder()
                .invoiceNumber(dto.getInvoiceNumber())
                .invoiceDate(dto.getInvoiceDate())
                .status(dto.getStatus())
                .currency(dto.getCurrency())
                .subtotal(dto.getSubtotal())
                .discountAmount(dto.getDiscountAmount())
                .taxAmount(dto.getTaxAmount())
                .totalAmount(dto.getTotalAmount())
                .taxIncluded(dto.getTaxIncluded())
                .pdfUrl(dto.getPdfUrl())
                .createdAt(dto.getCreatedAt())
                .lineItems(items)
                .build();
    }
}
