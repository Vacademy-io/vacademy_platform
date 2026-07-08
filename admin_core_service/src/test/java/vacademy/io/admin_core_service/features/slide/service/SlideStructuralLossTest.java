package vacademy.io.admin_core_service.features.slide.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for the server-side structural-block loss detector that backs the
 * draft/unsync/publish content-integrity guard. See
 * docs/SLIDE_CONTENT_LOSS_INVESTIGATION.md.
 */
class SlideStructuralLossTest {

    @Test
    void noLossWhenIdentical() {
        String h = "<p>hi</p><table><tbody><tr><td>c</td></tr></tbody></table>";
        assertEquals("", SlideService.describeStructuralLoss(h, h));
    }

    @Test
    void detectsDroppedTable() {
        String oldH = "<p>x</p><table><tbody><tr><td>c</td></tr></tbody></table>";
        String newH = "<p>x</p>";
        assertTrue(SlideService.describeStructuralLoss(oldH, newH).contains("table"));
    }

    @Test
    void detectsDroppedCustomBlock() {
        String oldH = "<div data-yoopta-type=\"flashcard\" data-front=\"a\"></div>";
        String newH = "<p>x</p>";
        assertTrue(SlideService.describeStructuralLoss(oldH, newH).contains("flashcard"));
    }

    @Test
    void detectsDroppedImageAndVideo() {
        assertTrue(SlideService.describeStructuralLoss("<img src=\"a\"><img src=\"b\">", "<img src=\"a\">")
                .contains("image"));
        assertTrue(SlideService.describeStructuralLoss("<video src=\"a\"></video>", "<p>gone</p>")
                .contains("video/embed"));
    }

    @Test
    void allowsPlainTextShrink() {
        // A user deleting text/paragraphs (but keeping the table) is NOT flagged.
        String oldH = "<p>lots of text here and even more here</p><table><tbody><tr><td>c</td></tr></tbody></table>";
        String newH = "<p>short</p><table><tbody><tr><td>c</td></tr></tbody></table>";
        assertEquals("", SlideService.describeStructuralLoss(oldH, newH));
    }

    @Test
    void noFalsePositiveWhenContentGrows() {
        assertEquals(
                "",
                SlideService.describeStructuralLoss(
                        "<img src=\"a\">",
                        "<img src=\"a\"><img src=\"b\"><table></table>"));
    }

    @Test
    void handlesNullOldContent() {
        // First-ever publish (no prior content) must never report loss.
        assertEquals("", SlideService.describeStructuralLoss(null, "<table></table>"));
    }
}
