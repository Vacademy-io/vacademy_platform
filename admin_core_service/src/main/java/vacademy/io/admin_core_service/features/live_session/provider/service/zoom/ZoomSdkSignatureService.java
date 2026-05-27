package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    /**
     * @param account       the Zoom account the meeting belongs to
     * @param meetingNumber the numeric Zoom meeting id (as a string)
     * @param role          0 = participant (learner), 1 = host/co-host
     * @return a signed JWT string suitable for ZoomMtg/embedded client.join()
     */
    public String buildSignature(ZoomAccount account, String meetingNumber, int role) {
        String sdkKey = account.getSdkClientKey();
        String sdkSecret = encryption.decrypt(account.getSdkClientSecretEnc());

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
        return account.getSdkClientKey();
    }

    public long getValiditySeconds() {
        return VALIDITY_SECONDS;
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
