package vacademy.io.admin_core_service.features.institute.service.setting;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The last line of defence before a certificate is drawn.
 *
 * <p>Nothing upstream guarantees a template only references tokens the renderer
 * knows about. An admin can place a field the platform has no value for, or
 * delete a custom field definition a saved template still references — and until
 * this scrub existed, the literal text {@code {{GRADE}}} printed on the
 * learner's certificate.
 */
class CertificateTokenScrubTest {

    @Test
    void removesTokensNothingResolved() {
        assertEquals("<p>Grade: </p>",
                InstituteSettingService.scrubUnresolvedTokens("<p>Grade: {{GRADE}}</p>"));
        assertEquals("<p>Grade: </p>",
                InstituteSettingService.scrubUnresolvedTokens("<p>Grade: {{ CF_GRADE }}</p>"));
    }

    /**
     * An unresolved image token leaves a broken-image icon rather than text, so
     * it is easy to miss in review — and just as wrong on the learner's PDF.
     */
    @Test
    void removesUnresolvedImageTokens() {
        String scrubbed = InstituteSettingService.scrubUnresolvedTokens(
                "<img src=\"{{SIGNATURE}}\" />");
        assertFalse(scrubbed.contains("{{"), "token survived: " + scrubbed);
    }

    /**
     * Only this pipeline's own token shape. An HTML-editor template can contain
     * hand-written CSS or script, and eating a brace pair there would corrupt a
     * template the admin authored deliberately.
     */
    @Test
    void leavesNonTokenBracesAlone() {
        String css = "<style>.a{color:red}</style><script>if(a){{b()}}</script>";
        assertEquals(css, InstituteSettingService.scrubUnresolvedTokens(css));

        String templating = "{{ user.name }}";
        assertEquals(templating, InstituteSettingService.scrubUnresolvedTokens(templating),
                "dotted expressions are not this pipeline's tokens");
    }

    @Test
    void toleratesNullAndBlank() {
        assertEquals(null, InstituteSettingService.scrubUnresolvedTokens(null));
        assertEquals("   ", InstituteSettingService.scrubUnresolvedTokens("   "));
    }

    /** A template with every token filled must come out byte-identical. */
    @Test
    void leavesAFullyResolvedTemplateUntouched() {
        String rendered = "<h1>Alex Sample</h1><p>Intro to Sample Course</p>";
        assertEquals(rendered, InstituteSettingService.scrubUnresolvedTokens(rendered));
        assertTrue(InstituteSettingService.scrubUnresolvedTokens(rendered).contains("Alex Sample"));
    }
}
