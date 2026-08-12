package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.Test;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Public certificate verification.
 *
 * <p>This is the one surface anyone on the internet can reach, so the tests here
 * are about disclosure and guessability rather than happy-path formatting.
 */
class CertificateVerificationServiceTest {

    private final CertificateVerificationService service =
            new CertificateVerificationService(null, null, null);

    private Institute institute(String portal) {
        Institute institute = new Institute();
        institute.setLearnerPortalBaseUrl(portal);
        return institute;
    }

    // ------------------------------------------------------------------ token

    /**
     * The token is the credential. Certificate numbers are sequential, so a
     * predictable token would make the whole institute enumerable.
     */
    @Test
    void tokensAreUnguessableAndUnique() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1_000; i++) {
            String token = service.newVerificationToken();
            assertTrue(token.length() >= 20, "token too short to resist guessing: " + token);
            assertTrue(seen.add(token), "duplicate token generated: " + token);
            assertTrue(token.matches("[A-Za-z0-9_-]+"), "token must be URL-safe: " + token);
        }
    }

    // -------------------------------------------------------------------- URL

    /**
     * A white-labelled school must send its graduates to its own domain, not to
     * a platform one.
     */
    @Test
    void verificationUrlUsesTheInstitutesOwnPortal() {
        String url = service.buildVerificationUrl(
                institute("student.edustream.ae"), "EDU2026001", "abc123");
        assertEquals("https://student.edustream.ae/verify/EDU2026001?t=abc123", url);
    }

    @Test
    void verificationUrlKeepsAnExplicitSchemeAndTrimsTrailingSlash() {
        assertEquals("https://student.edustream.ae/verify/EDU2026001?t=t1",
                service.buildVerificationUrl(institute("https://student.edustream.ae/"), "EDU2026001", "t1"));
        assertEquals("http://localhost:5173/verify/EDU2026001?t=t1",
                service.buildVerificationUrl(institute("http://localhost:5173"), "EDU2026001", "t1"));
    }

    /** No token or no portal means no verification URL — the caller falls back. */
    @Test
    void verificationUrlIsNullWhenItCannotBeBuilt() {
        assertNull(service.buildVerificationUrl(institute("student.edustream.ae"), "EDU2026001", null));
        assertNull(service.buildVerificationUrl(institute("student.edustream.ae"), "EDU2026001", "  "));
        assertNull(service.buildVerificationUrl(institute(null), "EDU2026001", "abc"));
        assertNull(service.buildVerificationUrl(institute("student.edustream.ae"), null, "abc"));
    }

    // ------------------------------------------------------------------- mask

    @Test
    void maskKeepsInitialsAndWordShape() {
        assertEquals("A··· S·····", CertificateVerificationService.maskName("Alex Sample"));
        assertEquals("P····· K····", CertificateVerificationService.maskName("Neeraj Kumar".replace("Neeraj", "Priyaa")));
    }

    /**
     * The point of masking: a harvested set of these must not be a name list.
     */
    @Test
    void maskNeverLeaksAnythingBeyondTheFirstLetter() {
        String masked = CertificateVerificationService.maskName("Alexandra Fitzgerald");
        assertFalse(masked.contains("lexandra"), "masked name leaked the given name: " + masked);
        assertFalse(masked.contains("itzgerald"), "masked name leaked the surname: " + masked);
        assertTrue(masked.startsWith("A"));
    }

    @Test
    void maskHandlesSingleNamesExtraSpacesAndBlanks() {
        assertEquals("M·····", CertificateVerificationService.maskName("Madhav"));
        assertEquals("A· B·", CertificateVerificationService.maskName("  Ab   Bc  "));
        assertEquals("", CertificateVerificationService.maskName(null));
        assertEquals("", CertificateVerificationService.maskName("   "));
    }

    // ------------------------------------------------------------------ probe

    /** A blank number or token must never reach the database. */
    @Test
    void verifyRejectsBlankInputWithoutQuerying() {
        // The repository is null here on purpose: if these guards were missing,
        // the call would NPE instead of returning empty.
        assertTrue(service.verify(null, "t").isEmpty());
        assertTrue(service.verify("EDU2026001", null).isEmpty());
        assertTrue(service.verify("  ", "  ").isEmpty());
    }
}
