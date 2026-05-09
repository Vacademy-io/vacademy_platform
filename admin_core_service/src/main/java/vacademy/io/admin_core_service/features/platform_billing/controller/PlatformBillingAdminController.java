package vacademy.io.admin_core_service.features.platform_billing.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.platform_billing.dto.PlatformPaymentConfigBootstrapRequest;
import vacademy.io.admin_core_service.features.platform_billing.service.PlatformPaymentConfigService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

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
}
