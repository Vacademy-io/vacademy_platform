package vacademy.io.admin_core_service.features.live_session.provider.controller.zoom;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAccountStore;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomWebhookService;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomWebhookSignatureService;

import java.util.Map;

/**
 * Receives Zoom webhook events. The URL is tenant-scoped by our internal account
 * id ({@code /zoom-callback/{accountId}}) so we know exactly which account's secret
 * to use — this also makes the one-time endpoint.url_validation challenge
 * unambiguous. No JWT (permitted in ApplicationSecurityConfig); authenticity is
 * enforced by the per-account HMAC signature.
 *
 * Reads the RAW request body so the HMAC matches byte-for-byte (re-serializing a
 * parsed DTO would reorder keys and break verification).
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions/provider/meeting")
@RequiredArgsConstructor
@Slf4j
public class ZoomWebhookController {

    private final ZoomAccountStore zoomAccountStore;
    private final ZoomWebhookSignatureService signatureService;
    private final ZoomWebhookService webhookService;
    private final ObjectMapper objectMapper;

    @PostMapping("/zoom-callback/{accountId}")
    public ResponseEntity<?> webhook(
            @PathVariable String accountId,
            @RequestBody String rawBody,
            @RequestHeader(name = "x-zm-signature", required = false) String signature,
            @RequestHeader(name = "x-zm-request-timestamp", required = false) String timestamp) {

        ZoomAccount account = zoomAccountStore.findById(accountId).orElse(null);
        if (account == null) {
            // Acknowledge so Zoom stops retrying a misconfigured URL, but log it.
            log.warn("zoom.webhook unknown accountId={}", accountId);
            return ResponseEntity.ok().build();
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
        String event = root.path("event").asText("");

        // One-time URL validation challenge: echo plainToken + its HMAC.
        if ("endpoint.url_validation".equals(event)) {
            String plainToken = root.path("payload").path("plainToken").asText(null);
            if (plainToken == null || account.getWebhookVerificationTokenEnc() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
            }
            String encryptedToken = signatureService.encryptForUrlValidation(account, plainToken);
            return ResponseEntity.ok(Map.of(
                    "plainToken", plainToken,
                    "encryptedToken", encryptedToken));
        }

        // All other events: verify the signature before acting.
        if (!signatureService.verify(account, rawBody, timestamp, signature)) {
            log.warn("zoom.webhook.invalid_sig accountId={} event={}", accountId, event);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            webhookService.handle(event, root, account);
        } catch (Exception e) {
            // Return 5xx so Zoom retries (it backs off and retries failed deliveries).
            log.error("zoom.webhook handler failed event={} accountId={}: {}",
                    event, accountId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.noContent().build();
    }
}
