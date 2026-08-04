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

    /**
     * A src-less <img> is an abandoned upload placeholder, not content: the editor's
     * importer drops it and formatHTMLString strips it on every save. Counting it
     * produced "This will remove 1 image" on saves where the author changed nothing.
     */
    @Test
    void ignoresPlaceholderImagesWithNoUsableSrc() {
        assertEquals("", SlideService.describeStructuralLoss("<img src=\"\" alt=\"pending\">", "<p>x</p>"));
        assertEquals("", SlideService.describeStructuralLoss("<img src=\"null\">", "<p>x</p>"));
        assertEquals("", SlideService.describeStructuralLoss("<img src=\"undefined\">", "<p>x</p>"));
        assertEquals("", SlideService.describeStructuralLoss("<img alt=\"no src at all\">", "<p>x</p>"));
    }

    @Test
    void stillDetectsRealImageLossAlongsidePlaceholders() {
        String oldH = "<img src=\"https://s3/a.png\"><img src=\"\">";
        assertTrue(SlideService.describeStructuralLoss(oldH, "<img src=\"\">").contains("1 image"));
    }

    @Test
    void countsImagesRegardlessOfQuoteStyleAndSpacing() {
        String oldH = "<img src = 'https://s3/a.png' ><IMG SRC=\"https://s3/b.png\">";
        assertEquals("", SlideService.describeStructuralLoss(oldH, oldH));
        assertTrue(SlideService.describeStructuralLoss(oldH, "<img src='https://s3/a.png'>")
                .contains("1 image"));
    }
}
