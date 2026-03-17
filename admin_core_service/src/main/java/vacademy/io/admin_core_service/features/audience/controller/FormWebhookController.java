package vacademy.io.admin_core_service.features.audience.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.service.FormWebhookService;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/api/v1/audience/webhook")
public class FormWebhookController {

    @Autowired
    private FormWebhookService formWebhookService;

    @PostMapping("/form")
    public ResponseEntity<String> handleFormWebhook(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-Vendor-ID", required = true) String vendorId) {

        String responseId = formWebhookService.processFormWebhookByVendorId(vendorId, payload);
        return ResponseEntity.ok(responseId);
    }
}
