package vacademy.io.notification_service.features.engagement_ledger.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.notification_service.features.engagement_ledger.dto.LedgerBatchRequest;
import vacademy.io.notification_service.features.engagement_ledger.dto.LedgerBatchResponse;
import vacademy.io.notification_service.features.engagement_ledger.service.EngagementLedgerService;

/**
 * Internal (service-to-service) ledger reads for the Engagement Engine in admin_core.
 *
 * SECURITY NOTE: this path is covered by WebSecurityConfig's permitAll on
 * "/notification-service/internal/**" — the service-wide convention (HmacAuthFilter exists as a
 * bean but is not wired into the filter chain, so every internal endpoint here is effectively
 * unauthenticated). admin_core calls it via InternalClientUtils.makeHmacRequest, which already
 * sends signed headers; when HMAC validation is wired into this service's chain, this endpoint
 * needs no caller changes. Tracked as part of the notification_service auth-posture cleanup —
 * do not add a bespoke one-off check here.
 */
@RestController
@RequestMapping("/notification-service/internal/v1/engagement")
@RequiredArgsConstructor
@Slf4j
public class EngagementLedgerInternalController {

    private final EngagementLedgerService engagementLedgerService;

    @PostMapping("/ledger-batch")
    public ResponseEntity<LedgerBatchResponse> ledgerBatch(@RequestBody LedgerBatchRequest request) {
        try {
            return ResponseEntity.ok(engagementLedgerService.ledgerBatch(request));
        } catch (IllegalArgumentException e) {
            log.warn("ledger-batch rejected: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
}
