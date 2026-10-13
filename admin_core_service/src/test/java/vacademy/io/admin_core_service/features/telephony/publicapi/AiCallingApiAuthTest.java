package vacademy.io.admin_core_service.features.telephony.publicapi;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

class AiCallingApiAuthTest {

    @Test
    void theKeyComesFromXApiKeyOrABearerToken() {
        MockHttpServletRequest r = new MockHttpServletRequest();
        assertNull(AiCallingApiAuth.presentedKey(r));
        r.addHeader("Authorization", "Bearer  vak_call_abc ");
        assertEquals("vak_call_abc", AiCallingApiAuth.presentedKey(r));
        MockHttpServletRequest x = new MockHttpServletRequest();
        x.addHeader("X-API-Key", "vak_call_def");
        x.addHeader("Authorization", "Bearer other");
        assertEquals("vak_call_def", AiCallingApiAuth.presentedKey(x));
    }

    @Test
    void aMissingKeyIsA401WithItsCode() {
        AiCallingApiAuth auth = new AiCallingApiAuth(null, null);
        AiCallingApiException e = assertThrows(AiCallingApiException.class,
                () -> auth.authenticate(new MockHttpServletRequest(), null));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getStatus());
        assertEquals("missing_api_key", e.getCode());
    }

    @Test
    void aKeyOfAnotherProductIsRefusedBeforeAnyLookup() {
        AiCallingApiAuth auth = new AiCallingApiAuth(null, null);
        MockHttpServletRequest r = new MockHttpServletRequest();
        r.addHeader("X-API-Key", "vak_eval_" + "0".repeat(48));
        AiCallingApiException e = assertThrows(AiCallingApiException.class, () -> auth.authenticate(r, null));
        assertEquals("invalid_api_key", e.getCode());
    }

    @Test
    void theRateLimitTripsAfterThePerMinuteBudget() {
        AiCallingApiAuth auth = new AiCallingApiAuth(null, null);
        for (int i = 0; i < AiCallingApiAuth.REQUESTS_PER_MINUTE; i++) auth.rateLimit("k1");
        AiCallingApiException e = assertThrows(AiCallingApiException.class, () -> auth.rateLimit("k1"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
        assertNotNull(e.getRetryAfterSeconds());
        auth.rateLimit("k2"); // another key is unaffected
    }
}
