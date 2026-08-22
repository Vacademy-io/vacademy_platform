package vacademy.io.admin_core_service.features.institute.service.setting;

import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Element;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The PDF pipeline appends {@code max-width: 100%; height: auto} to images so a
 * loose oversized image cannot run off the page. Inline styles outrank the
 * stylesheet, so applying that to a certificate's artwork replaced its
 * {@code height: 100%} with {@code height: auto} — the background then drew at
 * its own aspect ratio and left the rest of the page blank white.
 *
 * <p>It only reproduced when the uploaded artwork's aspect ratio differed from
 * the page, which is why the stock templates looked correct. These pin the
 * boundary between "the template placed this" and "this is a loose image".
 */
class CertificateBackgroundCoverageTest {

    private static Element img(String html) {
        return Jsoup.parse(html).selectFirst("img");
    }

    /** The full-bleed background is sized entirely by the stylesheet. */
    @Test
    void theBackgroundImageIsLeftAlone() {
        assertTrue(InstituteSettingService.isTemplatePositioned(img("<img class=\"bg\" src=\"a.png\"/>")));
    }

    /** Every field the visual editor emits is absolutely positioned. */
    @Test
    void absolutelyPositionedImagesAreLeftAlone() {
        assertTrue(InstituteSettingService.isTemplatePositioned(
                img("<img src=\"a.png\" style=\"position:absolute;left:10px;top:10px\"/>")));
    }

    /** An explicit size is a decision; a generic rule must not overwrite it. */
    @Test
    void explicitlySizedImagesAreLeftAlone() {
        assertTrue(InstituteSettingService.isTemplatePositioned(
                img("<img src=\"a.png\" style=\"width:229px;height:62px;object-fit:contain\"/>")));
        assertTrue(InstituteSettingService.isTemplatePositioned(img("<img src=\"a.png\" style=\"height: 90px\"/>")));
    }

    /** Spacing in the style attribute must not decide the outcome. */
    @Test
    void whitespaceInTheStyleDoesNotMatter() {
        assertTrue(InstituteSettingService.isTemplatePositioned(
                img("<img src=\"a.png\" style=\"position : absolute ; top : 0\"/>")));
    }

    /**
     * The original protection still has to apply to what it was written for: an
     * image pasted into rich text with no styling of its own.
     */
    @Test
    void looseImagesAreStillConstrained() {
        assertFalse(InstituteSettingService.isTemplatePositioned(img("<img src=\"a.png\"/>")));
        assertFalse(InstituteSettingService.isTemplatePositioned(
                img("<img src=\"a.png\" style=\"border:1px solid red\"/>")));
    }
}
