package vacademy.io.admin_core_service.features.platform_billing.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.platform_billing.dto.FulfillPaymentRequest;
import vacademy.io.admin_core_service.features.platform_billing.dto.PlatformPaymentConfigBootstrapRequest;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPayment;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformInvoiceRepository;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentRepository;
import vacademy.io.admin_core_service.features.platform_billing.service.PlatformPaymentConfigService;
import vacademy.io.admin_core_service.features.platform_billing.service.PlatformRazorpayWebHookService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.Map;

/**
 * ROOT_ADMIN-only endpoints for managing the singleton
 * {@code platform_payment_config} row (Vacademy's Razorpay credentials and
 * supplier identity for AI credit pack purchases).
 *
 *   POST /admin-core-service/super-admin/v1/platform-billing/bootstrap-config
 *        — one-shot bootstrap: encrypts secrets server-side, INSERTs the row.
 *          Refuses (409 Conflict) if a row already exists.
 *
 *   GET  /admin-core-service/super-admin/v1/platform-billing/config
 *        — read-only safe view (no secrets, even encrypted).
 *
 * Auth: routed through {@code SuperAdminAuthUtil.requireSuperAdmin(user)} like
 * the existing {@code SuperAdminCreditController}. Lives at the same
 * {@code /super-admin/v1/...} path so the existing JWT auth filter applies.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/super-admin/v1/platform-billing")
public class PlatformBillingAdminController {

    @Autowired
    private PlatformPaymentConfigService configService;

    @Autowired
    private PlatformRazorpayWebHookService webHookService;

    @Autowired
    private PlatformPaymentRepository paymentRepository;

    @Autowired
    private PlatformInvoiceRepository invoiceRepository;

    @PostMapping("/bootstrap-config")
    public ResponseEntity<Map<String, Object>> bootstrap(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody PlatformPaymentConfigBootstrapRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        log.info("platform_payment_config bootstrap requested by user={}", user.getUserId());

        String id = configService.bootstrap(
                request.getApiKey(),
                request.getKeySecret(),
                request.getWebhookSecret(),
                request.getSupplierLegalName(),
                request.getSupplierGstin(),
                request.getSupplierStateCode(),
                request.getSupplierAddress());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "id", id,
                "message", "platform_payment_config bootstrapped. Now register the "
                        + "webhook URL https://<your-host>/admin-core-service/payments/"
                        + "webhook/callback/razorpay-platform in Razorpay dashboard."));
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> describe(
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(configService.describeForAdmin());
    }

    /**
     * Manually run the fulfillment chain for a stuck platform_payment.
     *
     * Use case: Razorpay captured the payment but the webhook didn't reach us
     * (misconfigured URL, network blip, our service was briefly down). The order
     * sits at INITIATED forever and the customer doesn't see their credits.
     * Ops finds the {@code pay_*} id in the Razorpay dashboard and calls this
     * endpoint with the platform_payment.id.
     *
     * Idempotent — calling repeatedly is safe:
     *   - already-PAID payments: webhook service early-returns, this returns "already fulfilled"
     *   - duplicate credit grant: V243 partial UNIQUE on credit_transactions absorbs it
     *   - duplicate invoice: UNIQUE on platform_invoice.platform_payment_id absorbs it
     *
     * Reuses the same {@link PlatformRazorpayWebHookService#fulfillCreditPackPayment}
     * code path the webhook uses, so manually-recovered payments end up in the
     * exact same DB state as webhook-fulfilled ones.
     */
    @PostMapping("/fulfill-payment/{platformPaymentId}")
    public ResponseEntity<Map<String, Object>> fulfillPayment(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable("platformPaymentId") String platformPaymentId,
            @RequestBody(required = false) FulfillPaymentRequest request) {

        SuperAdminAuthUtil.requireSuperAdmin(user);
        log.info("Manual fulfill-payment requested by user={} for platform_payment={}",
                user.getUserId(), platformPaymentId);

        PlatformPayment payment = paymentRepository.findById(platformPaymentId)
                .orElseThrow(() -> new VacademyException(
                        "platform_payment not found: " + platformPaymentId));

        // Resolve the Razorpay pay_* id: prefer caller-supplied (more recent
        // info from the dashboard), fall back to whatever's already on the row.
        String suppliedPayId = request == null ? null : request.getVendorPaymentId();
        String existingPayId = payment.getVendorPaymentId();
        String vendorPaymentId = suppliedPayId != null && !suppliedPayId.isBlank()
                ? suppliedPayId.trim()
                : existingPayId;

        if (vendorPaymentId == null || vendorPaymentId.isBlank()) {
            throw new VacademyException(
                    "vendor_payment_id is required: the platform_payment row has no "
                  + "Razorpay pay_* id and none was supplied in the request body. "
                  + "Look up the payment in the Razorpay dashboard and pass it as "
                  + "{\"vendor_payment_id\": \"pay_...\"}.");
        }

        // Run the same fulfillment subroutine the webhook uses. This:
        //   - Marks platform_payment SUCCESS/PAID (sets vendor_payment_id)
        //   - Calls ai_service /grant-from-payment (idempotent on payment_id)
        //   - Generates platform_invoice + line items (idempotent on payment_id)
        //   - Sends confirmation email (best-effort)
        webHookService.fulfillCreditPackPayment(platformPaymentId, vendorPaymentId);

        // Re-load to report the post-fulfillment state to the caller.
        PlatformPayment after = paymentRepository.findById(platformPaymentId)
                .orElseThrow(() -> new VacademyException("vanished after fulfill: " + platformPaymentId));

        Map<String, Object> result = new HashMap<>();
        result.put("success", after.getPaymentStatus() != null
                && after.getPaymentStatus().name().equals("PAID"));
        result.put("platform_payment_id", after.getId());
        result.put("status", after.getStatus().name());
        result.put("payment_status", after.getPaymentStatus().name());
        result.put("vendor_payment_id", after.getVendorPaymentId());
        result.put("total_amount_minor", after.getTotalAmountMinor());
        result.put("currency", after.getCurrency());

        invoiceRepository.findByPlatformPaymentId(platformPaymentId)
                .ifPresent(inv -> {
                    result.put("invoice_number", inv.getInvoiceNumber());
                    result.put("invoice_pdf_s3_url", inv.getPdfS3Url());
                });

        // Convey "already fulfilled" vs "just fulfilled" so the caller knows
        // whether the call was a no-op.
        boolean wasAlreadyTerminal = "PAID".equals(after.getPaymentStatus().name())
                && existingPayId != null && existingPayId.equals(after.getVendorPaymentId());
        result.put("already_fulfilled_before_call", wasAlreadyTerminal);

        return ResponseEntity.ok(result);
    }
}
