package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.common.exceptions.VacademyException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies the platform-owned SDK resolver: a per-institute Meeting SDK app is preferred,
 * with fallback to the platform-configured app (zoom.sdk.client-id/secret) when the account
 * carries no SDK credentials, and a clear failure when neither is configured.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ZoomSdkSignatureServiceTest {

    @Mock private TokenEncryptionService encryption;

    private ZoomSdkSignatureService newService(String platformKey, String platformSecret) {
        ZoomSdkSignatureService service = new ZoomSdkSignatureService(encryption, new ObjectMapper());
        ReflectionTestUtils.setField(service, "platformSdkKey", platformKey);
        ReflectionTestUtils.setField(service, "platformSdkSecret", platformSecret);
        return service;
    }

    private ZoomAccount account(String sdkKey, String sdkSecretEnc) {
        return ZoomAccount.builder().sdkClientKey(sdkKey).sdkClientSecretEnc(sdkSecretEnc).build();
    }

    @Test
    void getSdkKey_prefersPerAccountKeyOverPlatform() {
        ZoomSdkSignatureService service = newService("platformKey", "platformSecret");
        assertEquals("acctKey", service.getSdkKey(account("acctKey", "acctSecretEnc")));
    }

    @Test
    void getSdkKey_fallsBackToPlatformWhenAccountKeyBlank() {
        ZoomSdkSignatureService service = newService("platformKey", "platformSecret");
        assertEquals("platformKey", service.getSdkKey(account("", null)));
    }

    @Test
    void getSdkKey_throwsWhenNeitherConfigured() {
        ZoomSdkSignatureService service = newService("", "");
        assertThrows(VacademyException.class, () -> service.getSdkKey(account(null, null)));
    }

    @Test
    void buildSignature_usesPerAccountSecret_whenPresent() {
        ZoomSdkSignatureService service = newService("platformKey", "platformSecret");
        when(encryption.decrypt("acctSecretEnc")).thenReturn("acctSecret");

        String sig = service.buildSignature(account("acctKey", "acctSecretEnc"), "123456789", 0);

        assertNotNull(sig);
        assertEquals(2L, sig.chars().filter(c -> c == '.').count()); // header.payload.signature
        verify(encryption).decrypt("acctSecretEnc");
    }

    @Test
    void buildSignature_usesPlatformSecret_whenAccountSecretBlank() {
        ZoomSdkSignatureService service = newService("platformKey", "platformSecret");

        String sig = service.buildSignature(account("", null), "123456789", 1);

        assertNotNull(sig);
        assertEquals(2L, sig.chars().filter(c -> c == '.').count());
        verify(encryption, never()).decrypt(anyString()); // platform secret used directly, no decrypt
    }
}
