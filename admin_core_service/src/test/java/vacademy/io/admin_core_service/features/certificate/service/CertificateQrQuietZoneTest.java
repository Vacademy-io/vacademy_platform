package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The white border around a certificate's QR code.
 *
 * <p>It is not decoration. A scanner locates the symbol by its three corner
 * patterns standing against blank space, and the QR specification requires four
 * modules of it. iText renders the bare matrix with no border at all, so a code
 * placed on certificate artwork sat directly against the design — it scanned,
 * but only if the phone was held just so, which is the worst kind of bug to
 * receive a report about.
 */
class CertificateQrQuietZoneTest {

    private final CertificateCodeService service = new CertificateCodeService();

    private BufferedImage decode(String dataUri) throws Exception {
        assertNotNull(dataUri, "no image was produced");
        assertTrue(dataUri.startsWith("data:image/png;base64,"), dataUri.substring(0, 40));
        byte[] png = Base64.getDecoder().decode(dataUri.substring("data:image/png;base64,".length()));
        return ImageIO.read(new ByteArrayInputStream(png));
    }

    /** Rows and columns at the very edge must be blank, all the way round. */
    private void assertBorderIsWhite(BufferedImage image, int border) {
        int white = 0xFFFFFF;
        for (int x = 0; x < image.getWidth(); x++) {
            for (int y = 0; y < border; y++) {
                assertEquals(white, image.getRGB(x, y) & white, "top border at x=" + x);
                assertEquals(white, image.getRGB(x, image.getHeight() - 1 - y) & white,
                        "bottom border at x=" + x);
            }
        }
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < border; x++) {
                assertEquals(white, image.getRGB(x, y) & white, "left border at y=" + y);
                assertEquals(white, image.getRGB(image.getWidth() - 1 - x, y) & white,
                        "right border at y=" + y);
            }
        }
    }

    @Test
    void aQrIsRenderedInsideItsQuietZone() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri("EDU2026001"));
        // Four modules at any sensible module size is comfortably more than 8px;
        // checking a smaller band keeps the test about the border existing
        // rather than about the exact module size iText picks.
        assertBorderIsWhite(image, 8);
    }

    /** A long verification URL is a denser symbol — the border still has to be there. */
    @Test
    void aLongPayloadAlsoGetsItsQuietZone() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri(
                "https://student.edustream.ae/verify/EDU2026001?t=Ab3xY9kLmN0pQrStUvWxYz"));
        assertBorderIsWhite(image, 8);
    }

    /** The symbol itself must survive: a blank image would pass a border check. */
    @Test
    void theCodeItselfIsStillDrawn() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri("EDU2026001"));
        boolean anyDark = false;
        for (int x = 0; x < image.getWidth() && !anyDark; x++) {
            for (int y = 0; y < image.getHeight(); y++) {
                if ((image.getRGB(x, y) & 0xFFFFFF) == 0) {
                    anyDark = true;
                    break;
                }
            }
        }
        assertTrue(anyDark, "the QR rendered as a blank white square");
    }

    /** Square in, square out — a stretched QR does not scan. */
    @Test
    void theBorderedImageStaysSquare() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri("EDU2026001"));
        assertEquals(image.getWidth(), image.getHeight());
    }

    /** A barcode carries its own start and stop patterns; no border is added. */
    @Test
    void barcodesAreUnaffected() throws Exception {
        BufferedImage image = decode(service.generateBarcodeDataUri("EDU2026001"));
        assertTrue(image.getWidth() > image.getHeight(), "a Code 128 should be wide, not square");
    }

    @Test
    void blankPayloadsProduceNothingRatherThanAnEmptyCode() {
        assertNull(service.generateQrDataUri(null));
        assertNull(service.generateQrDataUri("   "));
        assertNull(service.generateBarcodeDataUri(""));
    }
}
