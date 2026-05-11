package vacademy.io.admin_core_service.features.platform_billing.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.platform_billing.service.PlatformRazorpayWebHookService;

/**
 * Razorpay webhook endpoint for the platform's *own* Razorpay account
 * (institute -> Vacademy credit purchases).
 *
 * Distinct from {@code WebHookController}'s {@code /webhook/callback/razorpay},
 * which receives events for institutes' own Razorpay accounts (institute ->
 * learner enrollment).
 *
 * Both controllers live under {@code /admin-core-service/payments/...} so they
 * are covered by the same {@code /admin-core-service/payments/webhook/callback/**}
 * permitAll entry in {@code ApplicationSecurityConfig.ALLOWED_PATHS}. Razorpay
 * delivers webhooks without a JWT — they are authenticated by HMAC signature.
 *
 * Register this URL in our (Vacademy's) Razorpay dashboard:
 *   Production: https://api.vacademy.io/admin-core-service/payments/webhook/callback/razorpay-platform
 *
 * Reprocess: {@code POST /admin-core-service/payments/webhook/reprocess-platform/{webhookId}}
 * is a manual replay path for events that landed in FAILED state (e.g. ai_service
 * was briefly down during fulfillment). The existing
 * {@code /webhook/reprocess/{id}} on WebHookController hardcodes vendor=RAZORPAY
 * and would reject our RAZORPAY_PLATFORM events.
 */
@RestController
@RequestMapping("/admin-core-service/payments")
public class PlatformWebHookController {

    @Autowired
    private PlatformRazorpayWebHookService platformRazorpayWebHookService;

    @PostMapping("/webhook/callback/razorpay-platform")
    public ResponseEntity<String> handlePlatformRazorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        return platformRazorpayWebHookService.handleWebhook(payload, signature);
    }
}
