package vacademy.io.admin_core_service.features.platform_billing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.notification_service.service.PaymentNotificatonService;
import vacademy.io.admin_core_service.features.payments.enums.WebHookStatus;
import vacademy.io.admin_core_service.features.payments.service.WebHookService;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformInvoice;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentItem;
import vacademy.io.admin_core_service.features.platform_billing.enums.PlatformPaymentResult;
import vacademy.io.admin_core_service.features.platform_billing.enums.PlatformPaymentStatus;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentItemRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentRepository;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.payment.enums.PaymentType;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

/**
 * Webhook handler for Razorpay events on the *platform's* Razorpay account
 * (institute -> Vacademy AI credit pack purchases).
 *
 * Distinct from {@code RazorpayWebHookService} which handles per-institute
 * Razorpay accounts (institute -> learner enrollment).
 *
 * Pipeline:
 *   1. Persist raw event in `web_hook` with vendor='RAZORPAY_PLATFORM'
 *   2. Verify HMAC-SHA256 signature against the platform webhook secret
 *   3. Parse event type + notes.payment_type
 *   4. If payment_type != AI_CREDIT_PACK -> ack and skip (defense in depth)
 *   5. Switch on event type:
 *        payment.captured / order.paid -> grant credits + render invoice
 *        payment.failed                -> mark FAILED, no grant
 *        refund.processed/created       -> deduct credits via refund endpoint
 *
 * Idempotency:
 *   - At application level: handleCreditPackPayment bails out if
 *     platform_payment is already PAID.
 *   - At storage level: credit_transactions has a partial UNIQUE index on
 *     external_reference_id (V243); the Python /internal/grant-from-payment
 *     endpoint catches IntegrityError and returns already_processed=true.
 */
@Slf4j
@Service
public class PlatformRazorpayWebHookService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired private WebHookService webHookService;
    @Autowired private PlatformPaymentConfigService configService;
    @Autowired private PlatformPaymentRepository paymentRepository;
    @Autowired private PlatformPaymentItemRepository paymentItemRepository;
    @Autowired private PlatformInvoiceService platformInvoiceService;
    @Autowired private CreditClient creditClient;
    @Autowired private InstituteRepository instituteRepository;
    @Autowired private PaymentNotificatonService paymentNotificationService;

    public ResponseEntity<String> handleWebhook(String payload, String signature) {
        log.info("Received platform-Razorpay webhook payload (length={})",
                payload == null ? 0 : payload.length());

        // 1. Persist raw event
        String webhookId = webHookService.saveWebhook("RAZORPAY_PLATFORM", payload, null);

        try {
            // 2. Signature verify
            if (signature == null || signature.isBlank()) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED,
                        "Missing X-Razorpay-Signature header");
                return ResponseEntity.status(400).body("Missing signature");
            }
            String webhookSecret = configService.getWebhookSecret();
            if (!verifySignature(payload, signature, webhookSecret)) {
                log.error("Platform-Razorpay webhook signature verification failed");
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED,
                        "Invalid signature");
                return ResponseEntity.status(400).body("Invalid signature");
            }

            // 3. Parse
            JsonNode root = objectMapper.readTree(payload);
            String eventType = textOrNull(root, "event");
            JsonNode paymentEntity = extractPaymentEntity(root);
            JsonNode refundEntity = extractRefundEntity(root);

            // Defense-in-depth: only AI_CREDIT_PACK should arrive here. If
            // somebody mis-routes Razorpay events, ignore and ack so retries stop.
            if (paymentEntity != null) {
                String paymentType = extractPaymentType(paymentEntity);
                if (paymentType != null && !PaymentType.AI_CREDIT_PACK.name().equals(paymentType)) {
                    log.warn("Platform webhook received non-AI_CREDIT_PACK event "
                            + "(payment_type={}, event={}) — ignoring", paymentType, eventType);
                    webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED,
                            "Skipped: payment_type=" + paymentType);
                    return ResponseEntity.ok("Skipped");
                }
            }

            if (eventType == null) {
                webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED,
                        "Event type missing");
                return ResponseEntity.ok("No event type");
            }

            // 4. Route by event
            switch (eventType) {
                case "payment.captured":
                case "order.paid":
                    if (paymentEntity == null) {
                        webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED,
                                "No payment entity in event");
                        return ResponseEntity.ok("No payment entity");
                    }
                    String orderId = extractPlatformPaymentId(paymentEntity);
                    String razorpayPaymentId = textOrNull(paymentEntity, "id");
                    webHookService.updateWebHook(webhookId, payload, orderId, eventType);
                    fulfillCreditPackPayment(orderId, razorpayPaymentId);
                    break;

                case "payment.failed":
                    if (paymentEntity == null) {
                        webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED,
                                "No payment entity in event");
                        return ResponseEntity.ok("No payment entity");
                    }
                    String failedOrderId = extractPlatformPaymentId(paymentEntity);
                    webHookService.updateWebHook(webhookId, payload, failedOrderId, eventType);
                    handleCreditPackFailure(failedOrderId);
                    break;

                case "refund.processed":
                case "refund.created":
                    if (refundEntity == null) {
                        webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED,
                                "No refund entity in event");
                        return ResponseEntity.ok("No refund entity");
                    }
                    String refundedPaymentId = textOrNull(refundEntity, "payment_id");
                    String refundId = textOrNull(refundEntity, "id");
                    long refundedAmountMinor = refundEntity.has("amount") ? refundEntity.get("amount").asLong() : 0L;
                    webHookService.updateWebHook(webhookId, payload, refundedPaymentId, eventType);
                    handleCreditPackRefund(refundedPaymentId, refundId, refundedAmountMinor);
                    break;

                default:
                    log.info("Platform-Razorpay event {} not handled — ack and skip", eventType);
                    break;
            }

            webHookService.updateWebHookStatus(webhookId, WebHookStatus.PROCESSED, null);
            return ResponseEntity.ok("OK");

        } catch (Exception e) {
            log.error("Platform-Razorpay webhook processing failed", e);
            webHookService.updateWebHookStatus(webhookId, WebHookStatus.FAILED, e.getMessage());
            return ResponseEntity.status(500).body("Processing failed");
        }
    }

    // ───────────────────────────────────────────────────────────────
    // Event handlers
    // ───────────────────────────────────────────────────────────────

    /**
     * Mark a platform_payment PAID and run the full fulfillment chain:
     * grant credits in ai_service, render the GST invoice, send the
     * confirmation email. Idempotent at every layer (early return if
     * already PAID; V243 partial UNIQUE on credit_transactions; UNIQUE
     * on platform_invoice.platform_payment_id).
     *
     * Public so the {@code PlatformBillingAdminController.fulfillPayment}
     * stuck-payment recovery endpoint can reuse this exact code path —
     * we never want a manually-recovered payment to follow a different
     * path than a webhook-recovered one.
     *
     * @param platformPaymentId  our platform_payment.id (from webhook
     *                           {@code notes.orderId} or admin path var)
     * @param razorpayPaymentId  Razorpay's pay_* id (from webhook
     *                           paymentEntity.id or admin request body).
     *                           Must not be null — used as the dedup key
     *                           on credit_transactions.external_reference_id.
     */
    public void fulfillCreditPackPayment(String platformPaymentId, String razorpayPaymentId) {
        if (platformPaymentId == null) {
            log.error("Cannot fulfill: platformPaymentId is missing");
            return;
        }
        Optional<PlatformPayment> opt = paymentRepository.findById(platformPaymentId);
        if (opt.isEmpty()) {
            log.error("platform_payment not found for id={}", platformPaymentId);
            return;
        }
        PlatformPayment payment = opt.get();
        if (payment.getPaymentStatus() == PlatformPaymentResult.PAID
                || payment.getPaymentStatus() == PlatformPaymentResult.REFUNDED
                || payment.getPaymentStatus() == PlatformPaymentResult.PARTIALLY_REFUNDED) {
            log.info("platform_payment {} already in terminal state {} — no-op",
                    platformPaymentId, payment.getPaymentStatus());
            return;
        }

        // Mark PAID first
        payment.setStatus(PlatformPaymentStatus.SUCCESS);
        payment.setPaymentStatus(PlatformPaymentResult.PAID);
        payment.setVendorPaymentId(razorpayPaymentId);
        paymentRepository.save(payment);

        // Sum credits across line items (today always 1)
        List<PlatformPaymentItem> items = paymentItemRepository.findByPlatformPaymentId(platformPaymentId);
        BigDecimal totalCredits = items.stream()
                .map(PlatformPaymentItem::getCredits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String packCode = items.isEmpty() ? null : items.get(0).getPackCodeSnapshot();

        // Grant credits via internal AI-service endpoint (idempotent on razorpay payment_id)
        creditClient.grantFromPayment(
                payment.getInstituteId(),
                totalCredits,
                razorpayPaymentId,            // -> credit_transactions.external_reference_id
                payment.getId(),              // -> credit_transactions.reference_id
                packCode);

        // Render + persist GST invoice, then email confirmation. Both wrapped in
        // try/catch — credits are already granted, so a billing-side failure
        // shouldn't 500 the webhook (Razorpay would just retry).
        PlatformInvoice invoice = null;
        try {
            invoice = platformInvoiceService.generateInvoice(payment.getId());
        } catch (Exception e) {
            log.error("Invoice generation failed for platform_payment {}: {}",
                    payment.getId(), e.getMessage(), e);
        }

        try {
            sendPurchaseEmail(payment, items, totalCredits, invoice);
        } catch (Exception e) {
            log.error("Confirmation email failed for platform_payment {}: {}",
                    payment.getId(), e.getMessage(), e);
        }
    }

    private void sendPurchaseEmail(
            PlatformPayment payment,
            List<PlatformPaymentItem> items,
            BigDecimal totalCredits,
            PlatformInvoice invoice) {
        if (invoice == null) {
            // No invoice = no invoice number to put in the email; skip until v1.1
            // adds a separate "credits added" template that doesn't need one.
            return;
        }
        Optional<Institute> buyerOpt = instituteRepository.findById(payment.getInstituteId());
        if (buyerOpt.isEmpty()) {
            log.warn("Skipping confirmation email — institute {} not found", payment.getInstituteId());
            return;
        }
        Institute buyer = buyerOpt.get();
        String email = buyer.getEmail();
        if (email == null || email.isBlank()) {
            // v1: institute billing email is the only routing target. v1.1: also
            // notify the user who clicked Buy via buyerUserId -> auth service lookup.
            log.warn("Skipping confirmation email — institute {} has no email", payment.getInstituteId());
            return;
        }

        String packName = items.isEmpty() ? "AI Credits" : items.get(0).getPackCodeSnapshot();
        String totalDisplay = formatMajor(payment.getTotalAmountMinor(), payment.getCurrency());

        paymentNotificationService.sendCreditPackConfirmation(
                payment.getInstituteId(),
                email,
                payment.getBuyerUserId(),
                invoice.getInvoiceNumber(),
                totalCredits.stripTrailingZeros().toPlainString(),
                totalDisplay,
                packName);
    }

    private static String formatMajor(long amountMinor, String currency) {
        double major = amountMinor / 100.0;
        String symbol = "INR".equalsIgnoreCase(currency) ? "₹"
                : "USD".equalsIgnoreCase(currency) ? "$" : "";
        return symbol + String.format(java.util.Locale.ROOT, "%.2f", major);
    }

    private void handleCreditPackFailure(String platformPaymentId) {
        if (platformPaymentId == null) return;
        paymentRepository.findById(platformPaymentId).ifPresent(payment -> {
            if (payment.getPaymentStatus() == PlatformPaymentResult.PAID) {
                log.warn("Got payment.failed for already-PAID platform_payment {} — ignoring", platformPaymentId);
                return;
            }
            payment.setStatus(PlatformPaymentStatus.FAILED);
            payment.setPaymentStatus(PlatformPaymentResult.FAILED);
            paymentRepository.save(payment);
            log.info("platform_payment {} marked FAILED", platformPaymentId);
        });
    }

    private void handleCreditPackRefund(String razorpayPaymentId, String refundId, long refundedAmountMinor) {
        if (razorpayPaymentId == null || refundId == null) {
            log.warn("Refund event missing payment_id or refund_id — ignoring");
            return;
        }
        Optional<PlatformPayment> opt = paymentRepository.findByVendorPaymentId(razorpayPaymentId);
        if (opt.isEmpty()) {
            log.error("platform_payment not found for refund (razorpay_payment_id={})", razorpayPaymentId);
            return;
        }
        PlatformPayment payment = opt.get();
        List<PlatformPaymentItem> items = paymentItemRepository.findByPlatformPaymentId(payment.getId());

        // Pro-rate credits to the refunded amount.
        // refunded_credits = totalCredits * (refundedAmountMinor / totalAmountMinor)
        BigDecimal totalCredits = items.stream()
                .map(PlatformPaymentItem::getCredits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal proRated = totalCredits;
        if (payment.getTotalAmountMinor() != null && payment.getTotalAmountMinor() > 0) {
            proRated = totalCredits
                    .multiply(BigDecimal.valueOf(refundedAmountMinor))
                    .divide(BigDecimal.valueOf(payment.getTotalAmountMinor()), 2, java.math.RoundingMode.HALF_UP);
        }
        String packCode = items.isEmpty() ? null : items.get(0).getPackCodeSnapshot();

        creditClient.refundFromPayment(
                payment.getInstituteId(),
                proRated,
                refundId,           // -> credit_transactions.external_reference_id
                payment.getId(),    // -> credit_transactions.reference_id
                packCode);

        // Update payment status
        boolean fullyRefunded = payment.getTotalAmountMinor() != null
                && refundedAmountMinor >= payment.getTotalAmountMinor();
        payment.setPaymentStatus(fullyRefunded
                ? PlatformPaymentResult.REFUNDED
                : PlatformPaymentResult.PARTIALLY_REFUNDED);
        paymentRepository.save(payment);
        log.info("Refunded {} credits from platform_payment {} (refund_id={})",
                proRated, payment.getId(), refundId);
    }

    // ───────────────────────────────────────────────────────────────
    // JSON extractors
    // ───────────────────────────────────────────────────────────────

    private static String textOrNull(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) return null;
        return node.get(field).asText();
    }

    /** payload.payload.payment.entity */
    private JsonNode extractPaymentEntity(JsonNode root) {
        JsonNode payload = root.get("payload");
        if (payload == null) return null;
        JsonNode payment = payload.get("payment");
        if (payment == null) return null;
        return payment.get("entity");
    }

    /** payload.payload.refund.entity */
    private JsonNode extractRefundEntity(JsonNode root) {
        JsonNode payload = root.get("payload");
        if (payload == null) return null;
        JsonNode refund = payload.get("refund");
        if (refund == null) return null;
        return refund.get("entity");
    }

    private String extractPlatformPaymentId(JsonNode paymentEntity) {
        // We set notes.orderId = platform_payment.id when creating the order
        JsonNode notes = paymentEntity.get("notes");
        if (notes == null) return null;
        return textOrNull(notes, "orderId");
    }

    private String extractPaymentType(JsonNode paymentEntity) {
        JsonNode notes = paymentEntity.get("notes");
        if (notes == null) return null;
        return textOrNull(notes, "payment_type");
    }

    // ───────────────────────────────────────────────────────────────
    // HMAC signature verify (mirror of RazorpayWebHookService — kept inline
    // to avoid coupling the platform service to the institute-marketplace
    // service)
    // ───────────────────────────────────────────────────────────────

    private boolean verifySignature(String payload, String received, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                String h = Integer.toHexString(0xff & b);
                if (h.length() == 1) hex.append('0');
                hex.append(h);
            }
            return constantTimeEquals(hex.toString(), received);
        } catch (Exception e) {
            log.error("HMAC verification error", e);
            return false;
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }
}
