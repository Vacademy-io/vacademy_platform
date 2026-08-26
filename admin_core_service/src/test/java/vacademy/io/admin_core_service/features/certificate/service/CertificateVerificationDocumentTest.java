package vacademy.io.admin_core_service.features.certificate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.certificate.dto.CertificateVerificationDto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * What a scanned QR resolves to: the built-in page, or a document the institute
 * supplied instead.
 *
 * <p>The rules that matter here are the safety ones. An institute that never
 * opens the screen must keep the page it has today, a half-configured one must
 * still verify, and the document must never disclose more than the page.
 */
class CertificateVerificationDocumentTest {

    private final CertificateVerificationService service =
            new CertificateVerificationService(null, null, null);

    private static JsonNode config(String json) throws Exception {
        return new ObjectMapper().readTree(json);
    }

    /** Every institute predating this feature has no such key. */
    @Test
    void anUnconfiguredInstituteKeepsThePage() throws Exception {
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(config("{}")));
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(null));
    }

    /**
     * Switching the mode on is not enough. An admin who flips to DOCUMENT and
     * navigates away must not leave every certificate resolving to nothing.
     */
    @Test
    void documentModeWithoutADocumentFallsBackToThePage() throws Exception {
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(
                config("{\"verificationMode\":\"DOCUMENT\"}")));
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(
                config("{\"verificationMode\":\"DOCUMENT\",\"verificationDocumentHtml\":\"   \"}")));
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(
                config("{\"verificationMode\":\"DOCUMENT\",\"verificationDocumentType\":\"PDF\"}")));
    }

    @Test
    void documentModeServesTheDesignedHtml() throws Exception {
        assertEquals("DOCUMENT", CertificateVerificationService.resolveVerificationMode(
                config("{\"verificationMode\":\"DOCUMENT\",\"verificationDocumentHtml\":\"<p>hi</p>\"}")));
    }

    @Test
    void documentModeServesAnUploadedPdf() throws Exception {
        assertEquals("DOCUMENT", CertificateVerificationService.resolveVerificationMode(config(
                "{\"verificationMode\":\"DOCUMENT\",\"verificationDocumentType\":\"PDF\","
                        + "\"verificationDocumentFileId\":\"file-1\"}")));
    }

    /** A PDF upload must not be mistaken for HTML just because html is also set. */
    @Test
    void thePdfTypeWinsOverALeftoverHtmlDraft() throws Exception {
        assertEquals("PAGE", CertificateVerificationService.resolveVerificationMode(config(
                "{\"verificationMode\":\"DOCUMENT\",\"verificationDocumentType\":\"PDF\","
                        + "\"verificationDocumentHtml\":\"<p>draft</p>\"}")),
                "a PDF document with no file must not fall through to the HTML draft");
    }

    /**
     * The whole privacy guarantee: the document is filled from the verification
     * response, which masks the learner's name. If this ever read the raw
     * certificate row instead, a public URL would start disclosing full names.
     */
    @Test
    void theDocumentPrintsTheMaskedNameThePageShows() {
        CertificateVerificationDto dto = CertificateVerificationDto.builder()
                .learnerName("N···· H······")
                .certificateId("EDU2026001")
                .instituteName("EduStream")
                .courseName("Testing")
                .build();

        String out = service.substituteVerificationTokens(
                "<p>{{STUDENT_NAME}} — {{CERTIFICATE_ID}} — {{COURSE_NAME}}</p>", dto);

        assertTrue(out.contains("N···· H······"));
        assertTrue(out.contains("EDU2026001"));
        assertFalse(out.contains("{{"), "no token should survive substitution");
    }

    /**
     * An unresolved token printed literally reads as a broken record on a page
     * whose entire job is to look authoritative.
     */
    @Test
    void tokensWithNoVerificationValueAreBlankedNotPrinted() {
        CertificateVerificationDto dto = CertificateVerificationDto.builder()
                .certificateId("EDU2026001")
                .build();

        String out = service.substituteVerificationTokens("<p>[{{CF_GRADE}}][{{UNKNOWN_THING}}]</p>", dto);

        assertEquals("<p>[][]</p>", out);
    }

    /** A null value must render as empty rather than the string "null". */
    @Test
    void missingValuesRenderEmpty() {
        CertificateVerificationDto dto = CertificateVerificationDto.builder()
                .certificateId("EDU2026001")
                .build();

        String out = service.substituteVerificationTokens(
                "<p>{{COURSE_NAME}}|{{COMPLETION_PERCENTAGE}}|{{DATE_OF_COMPLETION}}</p>", dto);

        assertEquals("<p>||</p>", out);
    }
}
