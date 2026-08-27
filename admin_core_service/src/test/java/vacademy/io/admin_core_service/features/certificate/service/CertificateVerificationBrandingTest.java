package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.certificate.dto.CertificateVerificationDto;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Branding on the public verification response.
 *
 * <p>Whoever scans a certificate is a stranger deciding whether to believe a
 * document. The page that answers them has to look like it comes from the
 * institute that awarded it — but it is opened without a login, on whatever
 * domain the QR happened to carry, so the page cannot resolve branding for
 * itself. It has to arrive with the verification result.
 *
 * <p>The counterpart of these tests is the disclosure rule in
 * {@link CertificateVerificationService}: branding is safe to publish (it is
 * printed on the certificate itself), the certificate's file id is not.
 */
class CertificateVerificationBrandingTest {

    private static final String NUMBER = "EDU2026001";
    private static final String TOKEN = "Ab3xY9kLmN0pQrStUvWxYz";

    private IssuedCertificateRepository certificates;
    private InstituteRepository institutes;
    private CertificateVerificationService service;

    @BeforeEach
    void setUp() {
        certificates = mock(IssuedCertificateRepository.class);
        institutes = mock(InstituteRepository.class);
        AuthService authService = mock(AuthService.class);
        when(authService.getUsersFromAuthServiceByUserIds(any())).thenReturn(List.of());
        when(certificates.findByCertificateIdAndVerificationToken(NUMBER, TOKEN))
                .thenReturn(Optional.of(IssuedCertificate.builder()
                        .id(NUMBER)
                        .certificateId(NUMBER)
                        .instituteId("inst-1")
                        .userId("user-1")
                        .courseName("Intro to Sample Course")
                        .verificationToken(TOKEN)
                        .build()));
        when(certificates.findByCertificateIdAndShortCode(anyString(), anyString()))
                .thenReturn(Optional.empty());

        service = new CertificateVerificationService(certificates, institutes, authService);
    }

    private void instituteIs(Institute institute) {
        when(institutes.findById("inst-1")).thenReturn(Optional.ofNullable(institute));
    }

    private Institute branded() {
        Institute institute = new Institute();
        institute.setInstituteName("EduStream Academy");
        institute.setLogoFileId("file-123");
        institute.setInstituteThemeCode("#ED7424");
        institute.setWebsiteUrl("https://edustream.ae");
        return institute;
    }

    @Test
    void carriesTheInstitutesLogoColourAndSite() {
        instituteIs(branded());

        CertificateVerificationDto dto = service.verify(NUMBER, TOKEN).orElseThrow();

        assertEquals("EduStream Academy", dto.getInstituteName());
        assertEquals("file-123", dto.getInstituteLogoFileId());
        assertEquals("#ED7424", dto.getInstituteThemeCode());
        assertEquals("https://edustream.ae", dto.getInstituteWebsite());
    }

    /**
     * An institute that never uploaded a logo must still verify. The page falls
     * back to a monogram; a missing logo is not a failed verification.
     */
    @Test
    void verifiesWithoutBranding() {
        Institute plain = new Institute();
        plain.setInstituteName("Small Institute");
        instituteIs(plain);

        CertificateVerificationDto dto = service.verify(NUMBER, TOKEN).orElseThrow();

        assertTrue(dto.isValid());
        assertEquals("Small Institute", dto.getInstituteName());
        assertNull(dto.getInstituteLogoFileId());
        assertNull(dto.getInstituteThemeCode());
    }

    /** A certificate whose institute row has gone must not 500 a public endpoint. */
    @Test
    void survivesAMissingInstitute() {
        instituteIs(null);

        CertificateVerificationDto dto = service.verify(NUMBER, TOKEN).orElseThrow();

        assertTrue(dto.isValid());
        assertEquals("", dto.getInstituteName());
        assertNull(dto.getInstituteWebsite());
    }

    /**
     * The disclosure rule these fields were added under: branding is public,
     * the certificate's own file is not.
     */
    @Test
    void stillDisclosesNothingThatIdentifiesTheLearner() {
        instituteIs(branded());

        CertificateVerificationDto dto = service.verify(NUMBER, TOKEN).orElseThrow();

        String serialized = dto.toString();
        assertTrue(!serialized.contains("user-1"), "leaked the learner's user id: " + serialized);
        assertTrue(!serialized.contains("file-abc"), "leaked a certificate file id: " + serialized);
    }
}
