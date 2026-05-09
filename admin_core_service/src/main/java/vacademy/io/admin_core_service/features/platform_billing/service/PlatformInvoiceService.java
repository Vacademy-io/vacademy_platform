package vacademy.io.admin_core_service.features.platform_billing.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.credits.repository.CreditPackRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoice;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoiceLineItem;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentConfig;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentItem;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformInvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformInvoiceRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentItemRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Generates a GST-compliant invoice ({@link PlatformInvoice} +
 * {@link PlatformInvoiceLineItem}) for a paid {@link PlatformPayment}.
 *
 * Idempotent on platform_payment_id (the platform_invoice table has a UNIQUE
 * constraint there) — re-invocation returns the existing row.
 *
 * v1 scope: persists the invoice header + line items with all snapshot fields.
 * Invoice number is allocated atomically via the {@code ai_credit_invoice_sequence}
 * upsert pattern.
 *
 * Out of v1 scope (TODO for v1.1): HTML rendering, PDF conversion via
 * openhtmltopdf-pdfbox, and S3 upload populating {@code pdf_s3_url}.
 */
@Slf4j
@Service
public class PlatformInvoiceService {

    @PersistenceContext
    private EntityManager entityManager;

    private final PlatformPaymentRepository paymentRepository;
    private final PlatformPaymentItemRepository paymentItemRepository;
    private final PlatformInvoiceRepository invoiceRepository;
    private final PlatformInvoiceLineItemRepository invoiceLineItemRepository;
    private final InstituteRepository instituteRepository;
    private final CreditPackRepository packRepository;
    private final PlatformPaymentConfigService configService;

    public PlatformInvoiceService(
            PlatformPaymentRepository paymentRepository,
            PlatformPaymentItemRepository paymentItemRepository,
            PlatformInvoiceRepository invoiceRepository,
            PlatformInvoiceLineItemRepository invoiceLineItemRepository,
            InstituteRepository instituteRepository,
            CreditPackRepository packRepository,
            PlatformPaymentConfigService configService) {
        this.paymentRepository = paymentRepository;
        this.paymentItemRepository = paymentItemRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineItemRepository = invoiceLineItemRepository;
        this.instituteRepository = instituteRepository;
        this.packRepository = packRepository;
        this.configService = configService;
    }

    @Transactional
    public PlatformInvoice generateInvoice(String platformPaymentId) {
        // Idempotency at the application level — DB UNIQUE on platform_payment_id
        // is the safety net.
        Optional<PlatformInvoice> existing = invoiceRepository.findByPlatformPaymentId(platformPaymentId);
        if (existing.isPresent()) {
            log.info("Invoice already exists for platform_payment {}, returning existing", platformPaymentId);
            return existing.get();
        }

        PlatformPayment payment = paymentRepository.findById(platformPaymentId)
                .orElseThrow(() -> new VacademyException(
                        "platform_payment not found: " + platformPaymentId));

        Institute buyer = instituteRepository.findById(payment.getInstituteId())
                .orElseThrow(() -> new VacademyException(
                        "buyer institute not found: " + payment.getInstituteId()));

        PlatformPaymentConfig supplier = configService.load();
        List<PlatformPaymentItem> items = paymentItemRepository.findByPlatformPaymentId(platformPaymentId);
        if (items.isEmpty()) {
            throw new VacademyException("platform_payment has no items: " + platformPaymentId);
        }

        // Aggregate tax across line items — today always 1, but the math
        // is general so multi-pack carts work later without changes.
        long baseTotal = 0L;
        long cgstTotal = 0L;
        long sgstTotal = 0L;
        long igstTotal = 0L;
        long grandTotal = 0L;

        // Determine place of supply + export from buyer state vs supplier state.
        boolean isExport = !"INR".equalsIgnoreCase(payment.getCurrency());
        String placeOfSupply = isExport
                ? "96"
                : (buyer.getStateCode() != null ? buyer.getStateCode() : supplier.getSupplierStateCode());
        boolean intraState = !isExport
                && buyer.getStateCode() != null
                && supplier.getSupplierStateCode().equalsIgnoreCase(buyer.getStateCode());

        // 1. Allocate invoice number atomically
        String yyyymm = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        int seqNo = nextInvoiceSeq(yyyymm);
        String invoiceNumber = String.format("INV-AICRED-%s-%04d", yyyymm, seqNo);

        // 2. Insert invoice header (use placeholder totals — patched after lines)
        PlatformInvoice invoice = new PlatformInvoice();
        invoice.setPlatformPaymentId(payment.getId());
        invoice.setInvoiceNumber(invoiceNumber);

        invoice.setSupplierLegalName(supplier.getSupplierLegalName());
        invoice.setSupplierGstin(supplier.getSupplierGstin());
        invoice.setSupplierStateCode(supplier.getSupplierStateCode());
        invoice.setSupplierAddress(supplier.getSupplierAddress());

        invoice.setBuyerInstituteId(buyer.getId());
        invoice.setBuyerLegalName(safe(buyer.getInstituteName(), "Institute"));
        invoice.setBuyerGstin(buyer.getGstin());
        invoice.setBuyerStateCode(buyer.getStateCode());
        invoice.setBuyerAddress(buildBuyerAddress(buyer));

        invoice.setPlaceOfSupply(placeOfSupply);
        invoice.setIsExport(isExport);
        invoice.setCurrency(payment.getCurrency());
        invoice.setBaseAmountMinor(0L);
        invoice.setCgstAmountMinor(0L);
        invoice.setSgstAmountMinor(0L);
        invoice.setIgstAmountMinor(0L);
        invoice.setTotalAmountMinor(0L);
        invoice.setIssuedAt(LocalDateTime.now());
        invoice = invoiceRepository.saveAndFlush(invoice);

        // 3. Per-line items
        for (PlatformPaymentItem item : items) {
            // Pull pack name from catalog (snapshot may have changed) — fall back
            // to the snapshot code if the pack was deleted.
            String packName = packRepository.findById(item.getPackId())
                    .map(p -> p.getName())
                    .orElse(item.getPackCodeSnapshot());

            int cgstBps;
            int sgstBps;
            int igstBps;
            long lineCgst;
            long lineSgst;
            long lineIgst;

            if (isExport) {
                cgstBps = sgstBps = igstBps = 0;
                lineCgst = lineSgst = lineIgst = 0L;
            } else if (intraState) {
                cgstBps = sgstBps = item.getTaxRateBps() / 2;
                igstBps = 0;
                lineCgst = item.getTaxAmountMinor() / 2;
                lineSgst = item.getTaxAmountMinor() - lineCgst;  // absorb rounding
                lineIgst = 0L;
            } else {
                cgstBps = sgstBps = 0;
                igstBps = item.getTaxRateBps();
                lineCgst = lineSgst = 0L;
                lineIgst = item.getTaxAmountMinor();
            }

            PlatformInvoiceLineItem line = new PlatformInvoiceLineItem();
            line.setPlatformInvoiceId(invoice.getId());
            line.setDescription(packName + " — " + item.getCredits().stripTrailingZeros().toPlainString()
                    + " AI credits");
            line.setHsnSacCode(item.getHsnSacSnapshot());
            line.setQuantity(java.math.BigDecimal.ONE);
            line.setUnitPriceMinor(item.getBaseAmountMinor());
            line.setBaseAmountMinor(item.getBaseAmountMinor());
            line.setCgstRateBps(cgstBps);
            line.setCgstAmountMinor(lineCgst);
            line.setSgstRateBps(sgstBps);
            line.setSgstAmountMinor(lineSgst);
            line.setIgstRateBps(igstBps);
            line.setIgstAmountMinor(lineIgst);
            line.setTotalAmountMinor(item.getTotalAmountMinor());
            invoiceLineItemRepository.save(line);

            baseTotal += item.getBaseAmountMinor();
            cgstTotal += lineCgst;
            sgstTotal += lineSgst;
            igstTotal += lineIgst;
            grandTotal += item.getTotalAmountMinor();
        }

        // 4. Patch invoice totals
        invoice.setBaseAmountMinor(baseTotal);
        invoice.setCgstAmountMinor(cgstTotal);
        invoice.setSgstAmountMinor(sgstTotal);
        invoice.setIgstAmountMinor(igstTotal);
        invoice.setTotalAmountMinor(grandTotal);
        invoice = invoiceRepository.save(invoice);

        log.info("Generated invoice {} for platform_payment {} (₹/$ minor total = {})",
                invoiceNumber, platformPaymentId, grandTotal);

        // TODO v1.1: render HTML invoice via openhtmltopdf-pdfbox, upload to
        // S3 via MediaService, set pdfS3Url, save again.
        return invoice;
    }

    /**
     * Atomic next-number allocation:
     *   INSERT (m, 1) ON CONFLICT (m) DO UPDATE SET last_no = last_no + 1
     *   RETURNING last_no
     * Returns 1 on the first call of a given month, 2 on the second, etc.
     */
    private int nextInvoiceSeq(String yyyymm) {
        Object result = entityManager.createNativeQuery(
                "INSERT INTO ai_credit_invoice_sequence (yyyymm, last_no) VALUES (:m, 1) "
              + "ON CONFLICT (yyyymm) "
              + "DO UPDATE SET last_no = ai_credit_invoice_sequence.last_no + 1 "
              + "RETURNING last_no")
            .setParameter("m", yyyymm)
            .getSingleResult();
        return ((Number) result).intValue();
    }

    private static String safe(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String buildBuyerAddress(Institute b) {
        StringBuilder sb = new StringBuilder();
        appendIfPresent(sb, b.getAddress());
        appendIfPresent(sb, b.getCity());
        appendIfPresent(sb, b.getState());
        appendIfPresent(sb, b.getPinCode());
        appendIfPresent(sb, b.getCountry());
        String addr = sb.toString().trim();
        return addr.isEmpty() ? null : addr;
    }

    private static void appendIfPresent(StringBuilder sb, String s) {
        if (s == null || s.isBlank()) return;
        if (sb.length() > 0) sb.append(", ");
        sb.append(s.trim());
    }
}
