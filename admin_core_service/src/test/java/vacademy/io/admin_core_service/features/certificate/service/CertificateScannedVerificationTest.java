package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.certificate.dto.CertificateVerificationDto;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verification from a raw scanned string — the path that makes a <em>barcode</em>
 * scan verifiable.
 *
 * <p>A QR scanner hands the phone a URL and the browser opens it. A barcode
 * scanner hands over text, so something has to accept that text and work out
 * what it is. These tests pin the shapes it must accept, and the one shape it
 * must keep rejecting.
 */
class CertificateScannedVerificationTest {

    private static final String NUMBER = "EDU2026001";
    private static final String TOKEN = "Ab3xY9kLmN0pQrStUvWxYz";
    private static final String SHORT_CODE = "A1B2C3D4E5";

    private IssuedCertificateRepository certificates;
    private CertificateVerificationService service;

    @BeforeEach
    void setUp() {
        certificates = mock(IssuedCertificateRepository.class);
        InstituteRepository institutes = mock(InstituteRepository.class);
        AuthService authService = mock(AuthService.class);
        when(institutes.findById(anyString())).thenReturn(Optional.empty());
        when(authService.getUsersFromAuthServiceByUserIds(any())).thenReturn(java.util.List.of());

        // Nothing resolves unless a test says so, so a wrong credential really
        // does return empty rather than falling through to a lenient default.
        when(certificates.findByCertificateIdAndVerificationToken(anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(certificates.findByCertificateIdAndShortCode(anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(certificates.findByShortCode(anyString())).thenReturn(Optional.empty());

        service = new CertificateVerificationService(certificates, institutes, authService);
    }

    private IssuedCertificate issued() {
        return IssuedCertificate.builder()
                .id(NUMBER)
                .certificateId(NUMBER)
                .instituteId("inst-1")
                .userId("user-1")
                .courseName("Intro to Sample Course")
                .verificationToken(TOKEN)
                .shortCode(SHORT_CODE)
                .build();
    }

    private void certificateResolvesByToken() {
        when(certificates.findByCertificateIdAndVerificationToken(NUMBER, TOKEN))
                .thenReturn(Optional.of(issued()));
    }

    private void certificateResolvesByShortCode() {
        when(certificates.findByCertificateIdAndShortCode(NUMBER, SHORT_CODE))
                .thenReturn(Optional.of(issued()));
        when(certificates.findByShortCode(SHORT_CODE)).thenReturn(Optional.of(issued()));
    }

    // -------------------------------------------------------------------- URL

    @Test
    void acceptsAVerificationUrlFromAQrScanner() {
        certificateResolvesByToken();

        Optional<CertificateVerificationDto> result =
                service.verifyScanned("https://student.edustream.ae/verify/" + NUMBER + "?t=" + TOKEN);

        assertTrue(result.isPresent());
        assertEquals(NUMBER, result.get().getCertificateId());
    }

    /** Scanner apps append trailing slashes and fragments; neither is the number. */
    @Test
    void toleratesScannerNoiseAroundTheUrl() {
        certificateResolvesByToken();

        assertTrue(service.verifyScanned(
                "  https://student.edustream.ae/verify/" + NUMBER + "?t=" + TOKEN + "#scanned  ").isPresent());
    }

    /**
     * Numbering patterns allow {@code /}, so a number can span what looks like
     * several path segments. Both the encoded form the QR now carries and the
     * unencoded form already printed on older certificates must resolve.
     */
    @Test
    void acceptsACertificateNumberContainingSlashes() {
        IssuedCertificate slashed = IssuedCertificate.builder()
                .id("EDU/2026/001").certificateId("EDU/2026/001")
                .instituteId("inst-1").userId("user-1").verificationToken(TOKEN).build();
        when(certificates.findByCertificateIdAndVerificationToken("EDU/2026/001", TOKEN))
                .thenReturn(Optional.of(slashed));

        assertTrue(service.verifyScanned(
                "https://student.edustream.ae/verify/EDU%2F2026%2F001?t=" + TOKEN).isPresent(),
                "encoded number must resolve");
        assertTrue(service.verifyScanned(
                "https://student.edustream.ae/verify/EDU/2026/001?t=" + TOKEN).isPresent(),
                "unencoded number already in circulation must still resolve");
    }

    @Test
    void acceptsAShortCodeCarriedInTheUrl() {
        certificateResolvesByShortCode();

        assertTrue(service.verifyScanned(
                "https://student.edustream.ae/verify/" + NUMBER + "?c=" + SHORT_CODE).isPresent());
    }

    // --------------------------------------------------------------- barcode

    /** What a verifying barcode encodes. */
    @Test
    void acceptsTheCompoundBarcodePayload() {
        certificateResolvesByShortCode();

        Optional<CertificateVerificationDto> result =
                service.verifyScanned(NUMBER + CertificateVerificationService.BARCODE_SEPARATOR + SHORT_CODE);

        assertTrue(result.isPresent());
        assertEquals(NUMBER, result.get().getCertificateId());
    }

    /** A barcode an institute chose to print without the number beside it. */
    @Test
    void acceptsABareShortCode() {
        certificateResolvesByShortCode();

        assertTrue(service.verifyScanned(SHORT_CODE).isPresent());
    }

    // ---------------------------------------------------------------- probing

    /**
     * The whole reason the credential exists. Certificate numbers are
     * sequential, so if a bare number verified, one certificate would expose
     * every learner in the institute.
     */
    @Test
    void refusesABareCertificateNumber() {
        certificateResolvesByToken();
        certificateResolvesByShortCode();

        assertTrue(service.verifyScanned(NUMBER).isEmpty(),
                "a bare certificate number must never verify — it is enumerable");
    }

    @Test
    void refusesAWrongCredential() {
        certificateResolvesByToken();

        assertTrue(service.verifyScanned(NUMBER + "*WRONGCODE0").isEmpty());
        assertTrue(service.verifyScanned(
                "https://student.edustream.ae/verify/" + NUMBER + "?t=wrong").isEmpty());
    }

    /**
     * A URL with no credential at all must not degrade into a number-only
     * lookup — that would be the enumeration hole reopened through the URL path.
     */
    @Test
    void refusesAVerificationUrlWithNoCredential() {
        assertTrue(service.verifyScanned("https://student.edustream.ae/verify/" + NUMBER).isEmpty());
        verify(certificates, never()).findByShortCode(NUMBER);
    }
}
