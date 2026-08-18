package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Fitting a real value into the box an admin drew.
 *
 * <p>The bug being fixed: a field sized against "Alex Sample" and filled with
 * "Bhuvaneshwari Ramachandran" used to be sliced at both ends, because the box
 * centres its content and clipped the overflow. The failure was invisible to the
 * admin and permanent on the learner's PDF.
 */
class CertificateTextFitServiceTest {

    private final CertificateTextFitService service = new CertificateTextFitService();

    // ------------------------------------------------------------ line counting

    @Test
    void shortValuesStayOnOneLine() {
        assertEquals(1, CertificateTextFitService.linesNeeded("Alex Sample", 400, 32));
    }

    @Test
    void longValuesWrapRatherThanRunOn() {
        int lines = CertificateTextFitService.linesNeeded(
                "Advanced Certificate in Data Science and Machine Learning", 400, 32);
        assertTrue(lines > 1, "a long course name should wrap, not stay on one line");
    }

    /**
     * A single unbroken token has no space to wrap at. Counting it as one line
     * would mean never shrinking it, and it would run straight off the
     * certificate — which is exactly what `overflow-wrap:break-word` prevents in
     * the rendered output, so the estimate has to model the same thing.
     */
    @Test
    void anUnbreakableWordIsCountedAsTheLinesItWillActuallyTake() {
        int lines = CertificateTextFitService.linesNeeded(
                "bhuvaneshwari.ramachandran@institute-example.ac.in", 120, 32);
        assertTrue(lines > 1, "an over-wide single word must count as multiple lines");
    }

    @Test
    void blankAndDegenerateInputsDoNotBlowUp() {
        assertEquals(1, CertificateTextFitService.linesNeeded(null, 400, 32));
        assertEquals(1, CertificateTextFitService.linesNeeded("   ", 400, 32));
        assertEquals(1, CertificateTextFitService.linesNeeded("Alex", 0, 32));
    }

    // -------------------------------------------------------------- font fitting

    /** The common case: nothing changes for a value that already fits. */
    @Test
    void aValueThatFitsKeepsTheAdminsChosenSize() {
        assertEquals(32.0, CertificateTextFitService.fitFontSize("Alex Sample", 400, 32), 0.001);
    }

    @Test
    void aLongValueIsShrunkUntilItFitsTwoLines() {
        double fitted = CertificateTextFitService.fitFontSize(
                "Advanced Certificate in Data Science and Machine Learning", 400, 32);
        assertTrue(fitted < 32, "expected a shrink, got " + fitted);
        assertTrue(CertificateTextFitService.linesNeeded(
                        "Advanced Certificate in Data Science and Machine Learning", 400, fitted) <= 2,
                "shrunk font still needs more than two lines");
    }

    /**
     * Shrinking without a floor would produce a name printed at 3px, which reads
     * as a rendering fault rather than a design. Past the floor the two-line
     * clamp takes over and clips instead.
     */
    @Test
    void shrinkingStopsAtAFloorRatherThanVanishing() {
        double fitted = CertificateTextFitService.fitFontSize(
                "Advanced Certificate in Data Science and Machine Learning for Working Professionals",
                60, 32);
        assertTrue(fitted >= 16.0, "font shrank below half the admin's size: " + fitted);
    }

    // ------------------------------------------------------------------- styling

    @Test
    void fontSizeIsReplacedInPlaceWithoutDisturbingOtherDeclarations() {
        String out = CertificateTextFitService.replaceFontSize(
                "width:100%;font-size:32px;color:#000000", 18);
        assertTrue(out.contains("font-size:18.00px"), out);
        assertTrue(out.contains("width:100%"), out);
        assertTrue(out.contains("color:#000000"), out);
        assertFalse(out.contains("32px"), out);
    }

    @Test
    void anAbsentFontSizeIsAppendedRatherThanLost() {
        assertTrue(CertificateTextFitService.replaceFontSize("color:#000000", 18)
                .contains("font-size:18.00px"));
        assertTrue(CertificateTextFitService.replaceFontSize("color:#000000;", 18)
                .contains("font-size:18.00px"));
        assertTrue(CertificateTextFitService.replaceFontSize(null, 18)
                .contains("font-size:18.00px"));
    }

    // -------------------------------------------------------------- the template

    private String field(String text, int width, int fontSize) {
        return "<html><body><div style=\"position:absolute\">"
                + "<div style=\"width:100%;font-size:" + fontSize + "px\""
                + " data-fit-width=\"" + width + "\" data-fit-size=\"" + fontSize + "\">"
                + text + "</div></div></body></html>";
    }

    @Test
    void fitsALongNameInAFieldSizedForAShortOne() {
        String out = service.fitTemplate(field("Bhuvaneshwari Ramachandran", 200, 32));
        assertTrue(out.contains("font-size:"), out);
        assertFalse(out.contains("font-size:32px"), "long name kept the oversized font: " + out);
    }

    @Test
    void leavesAValueThatAlreadyFitsCompletelyAlone() {
        String html = field("Alex Sample", 400, 32);
        assertTrue(service.fitTemplate(html).contains("font-size:32px"),
                "a value that fits must not be resized");
    }

    /**
     * The safety property that keeps every existing institute on its current
     * behaviour: hand-authored HTML templates carry no fit metadata, so they are
     * returned without even being parsed.
     */
    @Test
    void returnsHandAuthoredTemplatesUntouchedAndUnparsed() {
        String html = "<html><body><h1>{{STUDENT_NAME}}</h1><p>no fit metadata here</p></body></html>";
        assertSame(html, service.fitTemplate(html),
                "a template with no fit metadata must not even be parsed");
    }

    @Test
    void toleratesNullBlankAndMalformedMetadata() {
        assertSame(null, service.fitTemplate(null));
        assertSame("", service.fitTemplate(""));

        String bad = "<div data-fit-width=\"abc\" data-fit-size=\"xyz\" style=\"font-size:32px\">Name</div>";
        assertTrue(service.fitTemplate(bad).contains("font-size:32px"),
                "unparseable metadata should leave the field alone, not resize it wrongly");
    }

    /** An empty field (a token that resolved to nothing) has nothing to fit. */
    @Test
    void skipsEmptyFields() {
        String html = field("", 200, 32);
        assertTrue(service.fitTemplate(html).contains("font-size:32px"));
    }

    // ------------------------------------------------------------ legacy repair

    /** Markup as it was saved before fields learned to wrap. */
    private static final String LEGACY =
            "<div class=\"certificate-canvas\">"
            + "<span style=\"position:absolute;width:400px;font-size:32px;"
            + "white-space:nowrap;overflow:hidden;display:flex\">Bhuvaneshwari Ramachandran</span>"
            + "</div>";

    /**
     * ~500 institutes designed their certificate before this change and store
     * the rendered HTML, so without a render-time repair they would keep slicing
     * long names until someone happened to re-save.
     */
    @Test
    void repairsTemplatesSavedBeforeFieldsCouldWrap() {
        String out = service.fitTemplate(LEGACY);
        assertFalse(out.contains("white-space:nowrap"), "legacy template still forces one line: " + out);
        assertTrue(out.contains("overflow-wrap:break-word"), out);
    }

    /**
     * The old markup clipped on the same element that centres the text, so a
     * value that now wraps would show slivers of two lines instead of one clean
     * one.
     */
    @Test
    void stopsLegacyFieldsClippingTheirWrappedText() {
        assertFalse(service.fitTemplate(LEGACY).contains("overflow:hidden"));
    }

    /** An admin who wrote nowrap in their own HTML meant it. */
    @Test
    void neverTouchesHandAuthoredHtml() {
        String handWritten =
                "<html><body><h1 style=\"white-space:nowrap\">{{STUDENT_NAME}}</h1></body></html>";
        assertSame(handWritten, service.fitTemplate(handWritten),
                "hand-authored HTML must be left exactly as the admin wrote it");
    }

    /** Already-wrapping visual templates need no repair. */
    @Test
    void leavesModernVisualTemplatesAlone() {
        String modern = "<div class=\"certificate-canvas\"><span style=\"overflow:visible\">x</span></div>";
        assertSame(modern, service.fitTemplate(modern));
    }

    /**
     * The canvas rule's own `overflow` keeps the background artwork inside the
     * page. Unpinning it would let the design bleed off the certificate — a far
     * worse regression than the slicing being fixed.
     */
    @Test
    void neverUnpinsTheCanvasBackgroundClip() {
        String withCanvasRule =
                "<style>.certificate-canvas { position: relative; overflow: hidden; }</style>"
                + LEGACY;
        String out = service.fitTemplate(withCanvasRule);
        assertTrue(out.contains(".certificate-canvas { position: relative; overflow: hidden; }"),
                "the canvas background clip was altered: " + out);
    }
}
