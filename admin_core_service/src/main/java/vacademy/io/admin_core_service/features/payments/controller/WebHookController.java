package vacademy.io.admin_core_service.features.payments.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.payments.service.EwayPoolingService;
import vacademy.io.admin_core_service.features.payments.service.StripeWebHookService;

@RestController
@RequestMapping("/admin-core-service/payments")
public class WebHookController {
    @Autowired
    private StripeWebHookService stripeWebHookService;

    @Autowired
    private EwayPoolingService ewayPoolingService;

    @PostMapping("/webhook/callback/stripe")
    public ResponseEntity<String> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {

        return stripeWebHookService.processWebHook(payload, sigHeader);
    }

}
