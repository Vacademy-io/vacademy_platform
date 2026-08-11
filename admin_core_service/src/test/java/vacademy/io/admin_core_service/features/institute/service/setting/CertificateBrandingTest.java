package vacademy.io.admin_core_service.features.institute.service.setting;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The shipped default certificate template hardcoded one customer's domain
 * (WWW.CODECIRCLE.ORG) in its footer, so every institute using the default
 * issued certificates branded with someone else's website — 502 of 527
 * institutes had it baked into their saved template.
 *
 * <p>These pin the render-time repair, which is what fixes existing institutes
 * without rewriting their stored settings.
 */
class CertificateBrandingTest {

    private static final String FOOTER_HTML = """
            <div class="footer">…</div>
            <div class="footer-link">
                <p>WWW.CODECIRCLE.ORG</p>
            </div>
            </body>
            """;

    // ------------------------------------------------------- website formatting

    @Test
    void stripsSchemeAndTrailingSlashAndUppercases() {
        assertEquals("SHIKSHANATION.COM",
                InstituteSettingService.formatWebsiteForDisplay("https://shikshanation.com/"));
        assertEquals("ABCSCHOOL.COM",
                InstituteSettingService.formatWebsiteForDisplay("http://abcschool.com"));
        assertEquals("WWW.EXAMPLE.ORG",
                InstituteSettingService.formatWebsiteForDisplay("  www.example.org  "));
    }

    @Test
    void emptyWebsiteYieldsEmptyStringNotAToken() {
        assertEquals("", InstituteSettingService.formatWebsiteForDisplay(null));
        assertEquals("", InstituteSettingService.formatWebsiteForDisplay("   "));
    }

    // ------------------------------------------------------------ branding scrub

    /**
     * No website is shown by default: the footer block is removed outright rather
     * than swapped for the institute's own domain.
     */
    @Test
    void removesLegacyFooterBlockEntirely() {
        String out = InstituteSettingService.scrubHardcodedDefaultBranding(FOOTER_HTML);
        assertFalse(out.toUpperCase().contains("CODECIRCLE"),
                "another institute's domain must not survive rendering");
        assertFalse(out.contains("footer-link"), "the footer block should be dropped, not blanked");
        assertTrue(out.contains("</body>"), "the rest of the document must be untouched");
    }

    /** Fallback path: unexpected markup still gets the domain blanked. */
    @Test
    void blanksDomainEvenWhenFooterMarkupDoesNotMatch() {
        String odd = "<span id=\"x\">www.codecircle.org</span>";
        String out = InstituteSettingService.scrubHardcodedDefaultBranding(odd);
        assertFalse(out.toUpperCase().contains("CODECIRCLE"));
        assertTrue(out.contains("<span id=\"x\">"), "surrounding markup is preserved");
    }

    @Test
    void isCaseInsensitive() {
        String lower = "<div class=\"footer-link\"><p>www.codecircle.org</p></div>";
        String out = InstituteSettingService.scrubHardcodedDefaultBranding(lower);
        assertFalse(out.toUpperCase().contains("CODECIRCLE"));
    }

    /** A template that never mentioned the legacy domain must pass through untouched. */
    @Test
    void leavesUnaffectedTemplatesAlone() {
        String clean = "<div class=\"footer-link\"><p>WWW.MYSCHOOL.COM</p></div>";
        assertEquals(clean, InstituteSettingService.scrubHardcodedDefaultBranding(clean));
        assertEquals(null, InstituteSettingService.scrubHardcodedDefaultBranding(null));
    }

    /**
     * The token itself still substitutes, so an admin who deliberately adds
     * {{INSTITUTE_WEBSITE}} in the editor gets their own domain rendered.
     */
    @Test
    void manuallyAddedTokenIsUnaffectedByTheScrub() {
        String manual = "<div class=\"footer-link\"><p>{{INSTITUTE_WEBSITE}}</p></div>";
        assertEquals(manual, InstituteSettingService.scrubHardcodedDefaultBranding(manual));
    }
}
