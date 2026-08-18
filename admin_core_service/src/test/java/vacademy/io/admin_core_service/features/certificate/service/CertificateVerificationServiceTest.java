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

    /**
     * Encoding was added for numbers containing {@code /}. Every certificate
     * already in circulation has a number made of the characters the shipped
     * numbering patterns emit, and those must come out byte-identical — a QR
     * that changed shape here would stop matching certificates already printed
     * and emailed.
     */
    @Test
    void verificationUrlLeavesOrdinaryNumbersUnchanged() {
        for (String number : new String[] {
                "EDU2026001", "SN-2026-0001", "VA_0123_2026", "ABC-0001-2026", "EDU.2026.001" }) {
            assertEquals("https://p.example.com/verify/" + number + "?t=t1",
                    service.buildVerificationUrl(institute("p.example.com"), number, "t1"),
                    "encoding changed an existing certificate's QR payload: " + number);
        }
    }

    /**
     * Numbering patterns allow {@code /}. Unencoded, {@code EDU/2026/001} would
     * become three path segments and miss the verification route entirely.
     */
    @Test
    void verificationUrlEncodesTheCertificateNumber() {
        assertEquals("https://student.edustream.ae/verify/EDU%2F2026%2F001?t=t1",
                service.buildVerificationUrl(institute("student.edustream.ae"), "EDU/2026/001", "t1"));
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

    @Test
    void verifyScannedRejectsBlankInputWithoutQuerying() {
        assertTrue(service.verifyScanned(null).isEmpty());
        assertTrue(service.verifyScanned("   ").isEmpty());
    }

    // ------------------------------------------------------------- short code

    /**
     * The barcode's credential. Shorter than the token by necessity — see the
     * service javadoc — but still has to be unguessable and collision-free.
     */
    @Test
    void shortCodesAreUnguessableAndUnique() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            String code = service.newShortCode();
            assertEquals(10, code.length(), "short code length changed: " + code);
            assertTrue(seen.add(code), "duplicate short code generated: " + code);
        }
    }

    /**
     * Crockford base32: no I, L, O or U. The code is printed beside the barcode
     * and gets retyped by hand, so 1/I and 0/O must not be confusable.
     */
    @Test
    void shortCodesAvoidVisuallyConfusableCharacters() {
        for (int i = 0; i < 2_000; i++) {
            String code = service.newShortCode();
            assertTrue(code.matches("[0-9A-HJKMNP-TV-Z]+"),
                    "short code used an ambiguous character: " + code);
        }
    }

    // ---------------------------------------------------------- barcode payload

    @Test
    void barcodePayloadPairsTheNumberWithTheShortCode() {
        assertEquals("EDU2026001*A1B2C3D4E5",
                service.buildBarcodePayload("EDU2026001", "A1B2C3D4E5"));
    }

    /**
     * A legacy certificate has no short code. Returning null lets the caller
     * fall back to the bare number rather than printing a barcode that encodes
     * a dangling separator and verifies nothing.
     */
    @Test
    void barcodePayloadIsNullWhenThereIsNoShortCode() {
        assertNull(service.buildBarcodePayload("EDU2026001", null));
        assertNull(service.buildBarcodePayload("EDU2026001", "  "));
        assertNull(service.buildBarcodePayload(null, "A1B2C3D4E5"));
    }

    /**
     * The separator has to survive both Code 128 and a numbering pattern. The
     * separators {@code CertificateNumberService} emits ({@code -}, {@code /},
     * {@code _}) would make {@code NUM*CODE} ambiguous to split.
     */
    @Test
    void barcodeSeparatorDoesNotCollideWithNumberingSeparators() {
        String separator = CertificateVerificationService.BARCODE_SEPARATOR;
        assertFalse("-/_".contains(separator),
                "barcode separator collides with a numbering separator: " + separator);
    }
}
