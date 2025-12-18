package vacademy.io.admin_core_service.features.invoice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoicePaymentLogMappingRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLogLineItem;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
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

    // PaymentNotificatonService can be used for sending invoice emails in the future
    // @Autowired
    // private PaymentNotificatonService paymentNotificatonService;

    @Autowired
    private InstituteSettingService instituteSettingService;

    private static final String INVOICE_TEMPLATE_TYPE = "INVOICE";
    private static final String INVOICE_STATUS_GENERATED = "GENERATED";
    private static final String DEFAULT_INVOICE_PREFIX = "INV";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy");

    /**
     * Main method to generate invoice after payment confirmation
     * This method now supports multiple payment logs for a single invoice
     */
    @Transactional
    public Invoice generateInvoice(UserPlan userPlan, PaymentLog paymentLog, String instituteId) {
        try {
            log.info("Starting invoice generation for userPlanId: {}, paymentLogId: {}, instituteId: {}",
                    userPlan.getId(), paymentLog.getId(), instituteId);

            // Check if this payment log is already part of an invoice
            if (invoicePaymentLogMappingRepository.existsByPaymentLogId(paymentLog.getId())) {
                log.info("Payment log {} is already part of an invoice. Skipping invoice generation.", 
                        paymentLog.getId());
                return findInvoiceByPaymentLogId(paymentLog.getId());
            }

            // NOTE: Currently using single payment log per invoice
            // The mapping table structure supports multiple payment logs per invoice for future use
            // TODO: Implement multi-enrollment grouping logic when vendorId is properly set
            List<PaymentLog> paymentLogs = List.of(paymentLog);
            log.info("Generating invoice for single payment log: {}", paymentLog.getId());

            // 1. Build invoice data from payment log(s)
            InvoiceData invoiceData = buildInvoiceDataFromMultiplePaymentLogs(paymentLogs, instituteId);

            // 2. Generate invoice number
            String invoiceNumber = generateInvoiceNumber(instituteId);

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

            // 8. Send email (async - don't fail if email fails)
            try {
                sendInvoiceEmail(invoice, invoiceData.getUser(), instituteId);
            } catch (Exception e) {
                log.error("Failed to send invoice email for invoice: {}. Invoice generation will continue.", 
                        invoiceNumber, e);
            }

            log.info("Invoice generated successfully: {} with {} payment log(s)", 
                    invoiceNumber, paymentLogs.size());
            return invoice;

        } catch (Exception e) {
            log.error("Error generating invoice for userPlanId: {}, paymentLogId: {}", 
                    userPlan.getId(), paymentLog.getId(), e);
            throw new VacademyException("Failed to generate invoice: " + e.getMessage());
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
     * 
     * NOTE: Currently disabled - vendorId is dummy/same for all entries
     * This method is kept for future use when proper vendorId/transaction grouping is implemented
     * 
     * TODO: Implement proper grouping logic when:
     * - vendorId is properly set by payment gateway
     * - Or parent transaction ID is available in payment_specific_data
     * - Or webhook event ID groups multiple enrollments
     */
    @Deprecated
    private List<PaymentLog> findRelatedPaymentLogs(PaymentLog paymentLog, String instituteId) {
        // Currently returning only the single payment log
        // Multi-enrollment grouping will be implemented later
        log.debug("Using single payment log (grouping disabled): {}", paymentLog.getId());
        return List.of(paymentLog);
    }

    /**
     * Build invoice data from multiple PaymentLogs (for multi-batch enrollment)
     * This method works for BOTH single and multiple payment log scenarios:
     * - Single payment log: Creates invoice with 1 line item (1 plan/course)
     * - Multiple payment logs: Creates invoice with multiple line items (multiple plans/courses)
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
        Double taxRateValue = invoiceSettings.get("taxRate") != null ? 
                ((Number) invoiceSettings.get("taxRate")).doubleValue() : 0.0;
        BigDecimal taxRate = BigDecimal.valueOf(taxRateValue);
        String taxLabel = (String) invoiceSettings.getOrDefault("taxLabel", "Tax");

        // Aggregate data from all payment logs
        BigDecimal totalPaymentAmount = BigDecimal.ZERO;
        BigDecimal totalPlanPrice = BigDecimal.ZERO;
        BigDecimal totalDiscountAmount = BigDecimal.ZERO;
        List<InvoiceLineItemData> allLineItems = new ArrayList<>();
        String currency = firstPaymentLog.getCurrency();
        String paymentMethod = firstPaymentLog.getVendor();
        String transactionId = firstPaymentLog.getVendorId();
        LocalDateTime paymentDate = firstPaymentLog.getDate() != null ? 
                firstPaymentLog.getDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime() : 
                LocalDateTime.now();

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
            
            // Use payment amount from payment log
            BigDecimal paymentAmount;
            if (paymentLog.getPaymentAmount() != null && paymentLog.getPaymentAmount() > 0) {
                paymentAmount = BigDecimal.valueOf(paymentLog.getPaymentAmount());
            } else {
                // Fallback to plan price if payment amount is not set
                log.warn("Payment log {} has no payment amount, using plan price {} as fallback", 
                        paymentLog.getId(), planPrice);
                paymentAmount = planPrice;
            }
            totalPaymentAmount = totalPaymentAmount.add(paymentAmount);

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
        
        // Calculate tax and subtotal based on payment amount
        BigDecimal subtotal;
        BigDecimal taxAmount;

        if (taxIncluded) {
            // Tax is already included in payment amount
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            subtotal = totalAmount.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = totalAmount.subtract(subtotal);
        } else {
            // Tax is additional, so payment amount = subtotal + tax
            // We need to work backwards: if paymentAmount = subtotal * (1 + taxRate)
            BigDecimal divisor = BigDecimal.ONE.add(taxRate);
            subtotal = totalAmount.divide(divisor, 2, RoundingMode.HALF_UP);
            taxAmount = totalAmount.subtract(subtotal);
        }

        // Add tax as line item if applicable
        if (taxAmount != null && taxAmount.compareTo(BigDecimal.ZERO) > 0) {
            InvoiceLineItemData taxItem = InvoiceLineItemData.builder()
                    .itemType("TAX")
                    .description(taxLabel + " @ " + taxRate.multiply(BigDecimal.valueOf(100)).setScale(0) + "%")
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
                .build();

        log.debug("Invoice data built successfully from {} payment logs", paymentLogs.size());
        return invoiceData;
    }

    /**
     * Build line items for a single plan (used in multi-payment log scenario)
     */
    private List<InvoiceLineItemData> buildLineItemsForPlan(PaymentPlan paymentPlan, 
                                                           List<PaymentLogLineItem> paymentLogLineItems,
                                                           String paymentLogId,
                                                           BigDecimal paymentAmount) {
        List<InvoiceLineItemData> lineItems = new ArrayList<>();

        // Main plan item - use payment amount from payment log
        InvoiceLineItemData planItem = InvoiceLineItemData.builder()
                .itemType("PLAN")
                .description(paymentPlan.getName() + (paymentPlan.getDescription() != null ? 
                        " - " + paymentPlan.getDescription() : ""))
                .quantity(1)
                .unitPrice(paymentAmount)
                .amount(paymentAmount)
                .sourceId(paymentLogId) // Store payment log ID as source
                .build();
        lineItems.add(planItem);

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
                            .description(item.getSource() != null ? 
                                    "Discount: " + item.getSource() : "Discount")
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
     * Build invoice data from UserPlan, PaymentLog, and related entities (legacy method for single payment log)
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
        Double taxRateValue = invoiceSettings.get("taxRate") != null ? 
                ((Number) invoiceSettings.get("taxRate")).doubleValue() : 0.0;
        BigDecimal taxRate = BigDecimal.valueOf(taxRateValue);
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

        // Build line items
        List<InvoiceLineItemData> lineItems = buildLineItems(paymentPlan, paymentLogLineItems, 
                taxIncluded, taxRate, taxLabel, subtotal, taxAmount, totalAmount);

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
                .currency(paymentPlan.getCurrency() != null ? paymentPlan.getCurrency() : paymentLog.getCurrency())
                .taxIncluded(taxIncluded)
                .taxRate(taxRate)
                .taxLabel(taxLabel)
                .paymentMethod(paymentLog.getVendor())
                .transactionId(paymentLog.getVendorId())
                .paymentDate(paymentLog.getDate() != null ? 
                        paymentLog.getDate().toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime() : 
                        LocalDateTime.now())
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
                                                      BigDecimal totalAmount) {
        List<InvoiceLineItemData> lineItems = new ArrayList<>();

        // Main plan item - use total amount from payment log (which is the actual paid amount)
        InvoiceLineItemData planItem = InvoiceLineItemData.builder()
                .itemType("PLAN")
                .description(paymentPlan.getName() + (paymentPlan.getDescription() != null ? 
                        " - " + paymentPlan.getDescription() : ""))
                .quantity(1)
                .unitPrice(totalAmount)
                .amount(totalAmount)
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
                            .description(item.getSource() != null ? 
                                    "Discount: " + item.getSource() : "Discount")
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
     * Get invoice settings from institute
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getInvoiceSettings(Institute institute) {
        try {
            Object settingData = instituteSettingService.getSettingData(institute, "INVOICE_SETTING");
            if (settingData instanceof Map) {
                return (Map<String, Object>) settingData;
            }
        } catch (Exception e) {
            log.warn("Could not load invoice settings for institute: {}. Using defaults.", institute.getId(), e);
        }
        // Return default settings
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("taxIncluded", false);
        defaults.put("taxRate", 0.0);
        defaults.put("taxLabel", "Tax");
        defaults.put("currency", "INR");
        return defaults;
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
     * Load invoice template for institute
     */
    private String loadInvoiceTemplate(String instituteId) {
        try {
            // Try to get invoice template from Template entity
            var templates = templateService.getTemplatesByInstituteAndType(instituteId, INVOICE_TEMPLATE_TYPE);
            if (!templates.isEmpty()) {
                String content = templates.get(0).getContent();
                if (StringUtils.hasText(content)) {
                    log.debug("Loaded invoice template from Template entity for institute: {}", instituteId);
                    return content;
                }
            }
        } catch (Exception e) {
            log.warn("Could not load invoice template from Template entity for institute: {}", instituteId, e);
        }

        // Fallback to default template from resources
        log.info("Using default invoice template from resources for institute: {}", instituteId);
        return loadDefaultInvoiceTemplateFromResources();
    }

    /**
     * Load default invoice template from resources/templates/invoice/default_invoice.html
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
                log.error("Default invoice template file not found in resources/templates/invoice/default_invoice.html");
                throw new VacademyException("Default invoice template not found. Please ensure the template file exists at resources/templates/invoice/default_invoice.html");
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

        // Basic invoice info
        filled = filled.replace("{{invoice_number}}", invoiceData.getInvoiceNumber() != null ? 
                invoiceData.getInvoiceNumber() : "");
        filled = filled.replace("{{invoice_date}}", invoiceData.getInvoiceDate() != null ? 
                invoiceData.getInvoiceDate().format(DISPLAY_DATE_FORMATTER) : "");
        filled = filled.replace("{{due_date}}", invoiceData.getDueDate() != null ? 
                invoiceData.getDueDate().format(DISPLAY_DATE_FORMATTER) : "");

        // Institute info
        Institute institute = invoiceData.getInstitute();
        filled = filled.replace("{{institute_name}}", institute.getInstituteName() != null ? 
                institute.getInstituteName() : "");
        filled = filled.replace("{{institute_address}}", institute.getAddress() != null ? 
                institute.getAddress() : "");
        filled = filled.replace("{{institute_contact}}", institute.getMobileNumber() != null ? 
                institute.getMobileNumber() : (institute.getEmail() != null ? institute.getEmail() : ""));

        // Institute logo
        String instituteLogoHtml = buildInstituteLogoHtml(institute);
        filled = filled.replace("{{institute_logo}}", instituteLogoHtml);
        
        // Institute theme color - replace in CSS and HTML
        // Use dark green for BILL TO section and footer
        String defaultColor = "#1a5f3f"; // Dark green
        filled = filled.replace("{{theme_color}}", defaultColor);
        
        // Table header uses hardcoded orange color (#f78f1e) - no replacement needed

        // User info
        UserDTO user = invoiceData.getUser();
        filled = filled.replace("{{user_name}}", user.getFullName() != null ? user.getFullName() : "");
        filled = filled.replace("{{user_email}}", user.getEmail() != null ? user.getEmail() : "");
        filled = filled.replace("{{user_address}}", user.getAddressLine() != null ? user.getAddressLine() : "");

        // Financial info
        filled = filled.replace("{{subtotal}}", invoiceData.getSubtotal() != null ? 
                invoiceData.getSubtotal().toString() : "0.00");
        filled = filled.replace("{{tax_amount}}", invoiceData.getTaxAmount() != null ? 
                invoiceData.getTaxAmount().toString() : "0.00");
        filled = filled.replace("{{total_amount}}", invoiceData.getTotalAmount() != null ? 
                invoiceData.getTotalAmount().toString() : "0.00");
        filled = filled.replace("{{currency}}", invoiceData.getCurrency() != null ? 
                invoiceData.getCurrency() : "INR");

        // Payment info
        filled = filled.replace("{{payment_method}}", invoiceData.getPaymentMethod() != null ? 
                invoiceData.getPaymentMethod() : "");
        filled = filled.replace("{{transaction_id}}", invoiceData.getTransactionId() != null ? 
                invoiceData.getTransactionId() : "");
        filled = filled.replace("{{payment_date}}", invoiceData.getPaymentDate() != null ? 
                invoiceData.getPaymentDate().format(DISPLAY_DATE_FORMATTER) : "");

        // Line items table
        String lineItemsHtml = buildLineItemsHtml(invoiceData.getLineItems(), invoiceData.getCurrency());
        filled = filled.replace("{{line_items}}", lineItemsHtml);

        return filled;
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
                return "<div class=\"logo-container\"><img src=\"" + logoUrl + "\" alt=\"" + 
                       (institute.getInstituteName() != null ? institute.getInstituteName() : "Logo") + 
                       " Logo\" /></div>";
            }
        } catch (Exception e) {
            log.warn("Failed to get logo URL for institute: {}. Error: {}", 
                    institute.getId(), e.getMessage());
        }

        // Return empty div to maintain layout structure
        return "<div class=\"logo-container\"></div>";
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
     * @deprecated Use getInstituteThemeColor instead
     */
    @Deprecated
    private String getThemeColorFromInstitute(Institute institute) {
        return getInstituteThemeColor(institute);
    }

    /**
     * Build HTML table rows for line items
     */
    private String buildLineItemsHtml(List<InvoiceLineItemData> lineItems, String currency) {
        if (lineItems == null || lineItems.isEmpty()) {
            return "<tr><td colspan='4'>No items</td></tr>";
        }

        StringBuilder html = new StringBuilder();
        for (InvoiceLineItemData item : lineItems) {
            html.append("<tr>");
            html.append("<td>").append(item.getDescription() != null ? item.getDescription() : "").append("</td>");
            html.append("<td>").append(item.getQuantity() != null ? item.getQuantity() : 1).append("</td>");
            html.append("<td>").append(item.getUnitPrice() != null ? item.getUnitPrice().toString() : "0.00")
                    .append(" ").append(currency != null ? currency : "INR").append("</td>");
            html.append("<td>").append(item.getAmount() != null ? item.getAmount().toString() : "0.00")
                    .append(" ").append(currency != null ? currency : "INR").append("</td>");
            html.append("</tr>");
        }
        return html.toString();
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

            String processedHtml = processImagesForPdf(htmlWithCss);
            String baseUri = "file:///";
            builder.withHtmlContent(sanitizeToXhtml(processedHtml), baseUri);
            builder.useDefaultPageSize(210f, 297f, PdfRendererBuilder.PageSizeUnits.MM); // A4 portrait

            builder.toStream(outputStream);
            builder.run();

            return outputStream.toByteArray();
        } catch (Exception e) {
            log.error("Error generating PDF from HTML", e);
            throw new VacademyException("Failed to generate PDF: " + e.getMessage());
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
                    pdfBytes
            );

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

    /**
     * Send invoice email to user
     */
    private void sendInvoiceEmail(Invoice invoice, UserDTO user, String instituteId) {
        try {
            // This will be implemented to send email with invoice PDF attachment
            // For now, we'll use the existing payment notification service or create a new method
            log.info("Invoice email would be sent to: {} for invoice: {}", 
                    user.getEmail(), invoice.getInvoiceNumber());
            
            // TODO: Implement email sending with invoice PDF attachment
            // You can extend PaymentNotificatonService or create a new InvoiceEmailService
            
        } catch (Exception e) {
            log.error("Error sending invoice email", e);
            // Don't throw - email failure shouldn't fail invoice generation
        }
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
     * Get invoices by user ID
     */
    public List<InvoiceDTO> getInvoicesByUserId(String userId) {
        List<Invoice> invoices = invoiceRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return invoices.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    /**
     * Test method: Manually trigger invoice generation for testing purposes
     * This method will group related payment logs (same vendor_id or time window) into one invoice
     * This method is useful for testing invoice generation without going through the full payment flow
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
            String instituteId = paymentLog.getUserPlan().getEnrollInvite() != null ?
                    paymentLog.getUserPlan().getEnrollInvite().getInstituteId() : null;

            if (instituteId == null) {
                throw new VacademyException("Could not determine institute ID from payment log");
            }

            log.info("Test: Manually generating invoice for payment log: {} (will group related logs)", paymentLogId);
            Invoice invoice = generateInvoice(
                    paymentLog.getUserPlan(),
                    paymentLog,
                    instituteId
            );

            String pdfUrl = invoice.getPdfFileId() != null ? 
                    mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId()) : null;
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
     * Test method: Generate invoice for a SINGLE payment log only (no grouping)
     * This bypasses the grouping logic and creates an invoice for just this one payment log
     * Useful for testing single payment log scenarios without worrying about related logs
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
                String pdfUrl = existingInvoice.getPdfFileId() != null ? 
                        mediaService.getFileUrlById(existingInvoice.getPdfFileId()) : null;
                return "Payment log is already invoiced! Invoice Number: " + existingInvoice.getInvoiceNumber() + 
                       ", PDF File ID: " + existingInvoice.getPdfFileId() +
                       (pdfUrl != null ? ", PDF URL: " + pdfUrl : "");
            }

            // Get institute ID from user plan
            String instituteId = paymentLog.getUserPlan().getEnrollInvite() != null ?
                    paymentLog.getUserPlan().getEnrollInvite().getInstituteId() : null;

            if (instituteId == null) {
                throw new VacademyException("Could not determine institute ID from payment log");
            }

            log.info("Test: Generating invoice for SINGLE payment log only: {} (no grouping)", paymentLogId);

            // Build invoice data from ONLY this payment log (no grouping)
            InvoiceData invoiceData = buildInvoiceDataFromMultiplePaymentLogs(
                    List.of(paymentLog), // Only this one payment log
                    instituteId
            );

            // Generate invoice number
            String invoiceNumber = generateInvoiceNumber(instituteId);

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
                    instituteId
            );

            // Send email (async)
            try {
                sendInvoiceEmail(invoice, invoiceData.getUser(), instituteId);
            } catch (Exception e) {
                log.error("Failed to send invoice email for invoice: {}. Invoice generation will continue.", 
                        invoiceNumber, e);
            }

            String pdfUrl = invoice.getPdfFileId() != null ? 
                    mediaService.getFilePublicUrlByIdWithoutExpiry(invoice.getPdfFileId()) : null;
            return "Invoice generated successfully for SINGLE payment log! Invoice Number: " + 
                   invoice.getInvoiceNumber() + ", PDF File ID: " + invoice.getPdfFileId() +
                   (pdfUrl != null ? ", PDF URL: " + pdfUrl : "");
        } catch (Exception e) {
            log.error("Test: Failed to generate invoice for single payment log: {}", paymentLogId, e);
            throw new VacademyException("Failed to generate invoice: " + e.getMessage());
        }
    }

    /**
     * Map Invoice entity to DTO
     */
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
                .pdfUrl(invoice.getPdfFileId() != null ? 
                        mediaService.getFileUrlById(invoice.getPdfFileId()) : null) // Computed URL from file ID
                .taxIncluded(invoice.getTaxIncluded())
                .createdAt(invoice.getCreatedAt())
                .updatedAt(invoice.getUpdatedAt())
                .lineItems(lineItemDTOs)
                .build();
    }
}

