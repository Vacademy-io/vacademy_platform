package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.common.exceptions.VacademyException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builds the HS256 JWT signature the Zoom Web Meeting SDK requires to join/start
 * a meeting. The signature is signed with the account's Meeting SDK Client Secret
 * (decrypted on demand) and embeds the meeting number + role.
 *
 * Hand-rolled (Mac + Base64URL) to avoid pulling in a JWT dependency for a single
 * fixed-shape token. Format: base64url(header).base64url(payload).base64url(hmac).
 *
 * Signature validity is capped at 2 hours; the frontend re-fetches on the SDK's
 * "signature expired" error (3705) if a learner sits on the page longer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomSdkSignatureService {

    private static final long VALIDITY_SECONDS = 2 * 60 * 60; // 2 hours
    private static final String HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";

    private final TokenEncryptionService encryption;
    private final ObjectMapper objectMapper;

    // SDK signing credentials, resolved in order: per-account SDK creds → zoom.sdk.* override
    // → zoom.app.* (the General app's own id/secret, also used for OAuth). For a single Zoom
    // "General app" the SDK key/secret ARE the OAuth client id/secret, so you only set
    // zoom.app.* — set zoom.sdk.* only to point SDK signing at a DIFFERENT app. Platform-owned
    // signing is host-only / same-account safe (see docs/zoomintegration/zoom-onboarding-design.md).
    @Value("${zoom.sdk.client-id:}")
    private String platformSdkKey;

    @Value("${zoom.sdk.client-secret:}")
    private String platformSdkSecret;

    @Value("${zoom.app.client-id:}")
    private String appClientId;

    @Value("${zoom.app.client-secret:}")
    private String appClientSecret;

    /**
     * @param account       the Zoom account the meeting belongs to
     * @param meetingNumber the numeric Zoom meeting id (as a string)
     * @param role          0 = participant (learner), 1 = host/co-host
     * @return a signed JWT string suitable for ZoomMtg/embedded client.join()
     */
    public String buildSignature(ZoomAccount account, String meetingNumber, int role) {
        String sdkKey = resolveSdkKey(account);
        String sdkSecret = resolveSdkSecret(account);

        long iat = Instant.now().getEpochSecond() - 30; // small skew allowance
        long exp = iat + VALIDITY_SECONDS;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("appKey", sdkKey);
        payload.put("sdkKey", sdkKey);
        payload.put("mn", meetingNumber);
        payload.put("role", role);
        payload.put("iat", iat);
        payload.put("exp", exp);
        payload.put("tokenExp", exp);

        try {
            String headerB64 = base64Url(HEADER_JSON.getBytes(StandardCharsets.UTF_8));
            String payloadB64 = base64Url(objectMapper.writeValueAsString(payload)
                    .getBytes(StandardCharsets.UTF_8));
            String signingInput = headerB64 + "." + payloadB64;
            String sigB64 = base64Url(hmacSha256(sdkSecret, signingInput));
            return signingInput + "." + sigB64;
        } catch (JsonProcessingException e) {
            throw new VacademyException("Failed to serialize Zoom SDK signature payload");
        }
    }

    /** The SDK key (Meeting SDK Client Key) the frontend passes alongside the signature. */
    public String getSdkKey(ZoomAccount account) {
        return resolveSdkKey(account);
    }

    public long getValiditySeconds() {
        return VALIDITY_SECONDS;
    }

    /** Per-account SDK key wins; fall back to the platform-owned SDK app when the account has none. */
    private String resolveSdkKey(ZoomAccount account) {
        String accountKey = account.getSdkClientKey();
        if (accountKey != null && !accountKey.isBlank()) {
            return accountKey;
        }
        if (platformSdkKey != null && !platformSdkKey.isBlank()) {
            return platformSdkKey;
        }
        if (appClientId != null && !appClientId.isBlank()) {
            return appClientId;
        }
        throw new VacademyException(
                "No Meeting SDK key configured for this Zoom account or platform");
    }

    /** Per-account SDK secret wins; fall back to the platform-owned SDK app when the account has none. */
    private String resolveSdkSecret(ZoomAccount account) {
        String accountSecretEnc = account.getSdkClientSecretEnc();
        if (accountSecretEnc != null && !accountSecretEnc.isBlank()) {
            return encryption.decrypt(accountSecretEnc);
        }
        if (platformSdkSecret != null && !platformSdkSecret.isBlank()) {
            return platformSdkSecret;
        }
        if (appClientSecret != null && !appClientSecret.isBlank()) {
            return appClientSecret;
        }
        throw new VacademyException(
                "No Meeting SDK secret configured for this Zoom account or platform");
    }

    private static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new VacademyException("Failed to sign Zoom SDK JWT: " + e.getMessage());
        }
    }
}
