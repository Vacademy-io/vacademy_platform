package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/**
 * Verifies Zoom webhook authenticity.
 *
 * Zoom signs each webhook with:
 *   x-zm-signature = "v0=" + HMAC_SHA256(secretToken, "v0:{timestamp}:{rawBody}")
 * where timestamp is the x-zm-request-timestamp header. The same secret token is
 * used to answer the one-time endpoint.url_validation challenge.
 *
 * The secret is stored encrypted per account; callers pass the resolved account.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomWebhookSignatureService {

    private static final long REPLAY_WINDOW_SECONDS = 300; // reject webhooks older than 5 min

    private final TokenEncryptionService encryption;

    /**
     * Verifies the signature for an event webhook. Returns false (rather than
     * throwing) so the controller can decide the HTTP response.
     */
    public boolean verify(ZoomAccount account, String rawBody,
                          String timestamp, String signature) {
        if (account == null || account.getWebhookVerificationTokenEnc() == null) {
            return false;
        }
        if (signature == null || !signature.startsWith("v0=") || timestamp == null) {
            return false;
        }
        try {
            long ts = Long.parseLong(timestamp);
            if (Math.abs(Instant.now().getEpochSecond() - ts) > REPLAY_WINDOW_SECONDS) {
                log.warn("zoom.webhook.replay_window accountId={} ts={}", account.getId(), ts);
                return false;
            }
        } catch (NumberFormatException e) {
            return false;
        }

        String secret = encryption.decrypt(account.getWebhookVerificationTokenEnc());
        String expected = "v0=" + hmacHex(secret, "v0:" + timestamp + ":" + rawBody);

        // Constant-time comparison to avoid timing oracles.
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Computes the encryptedToken response for the endpoint.url_validation challenge:
     * HMAC_SHA256(secretToken, plainToken) as lowercase hex.
     */
    public String encryptForUrlValidation(ZoomAccount account, String plainToken) {
        String secret = encryption.decrypt(account.getWebhookVerificationTokenEnc());
        return hmacHex(secret, plainToken);
    }

    private static String hmacHex(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Zoom webhook HMAC failure", e);
        }
    }
}
