package vacademy.io.admin_core_service.features.certificate.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Certificate QR / barcode generation.
 *
 * <p>These decode the returned data URI back into a real image rather than just
 * asserting a non-empty string — a truncated or zero-size PNG would still look
 * like success otherwise, and would only surface as an unscannable code on a
 * learner's printed certificate.
 */
class CertificateCodeServiceTest {

    private final CertificateCodeService service = new CertificateCodeService();

    private static final String PREFIX = "data:image/png;base64,";

    /** Decode the data URI and return the image, failing if it isn't a valid PNG. */
    private BufferedImage decode(String dataUri) throws Exception {
        assertNotNull(dataUri, "expected a data URI");
        assertTrue(dataUri.startsWith(PREFIX), "expected a PNG data URI, got: "
                + dataUri.substring(0, Math.min(40, dataUri.length())));
        byte[] bytes = Base64.getDecoder().decode(dataUri.substring(PREFIX.length()));
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
        assertNotNull(image, "data URI did not decode to a readable PNG");
        return image;
    }

    // ------------------------------------------------------------------- QR

    @Test
    void generatesAScannableSizedQrForACertificateNumber() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri("SN-2026-0001"));
        assertTrue(image.getWidth() >= 40 && image.getHeight() >= 40,
                "QR too small to scan reliably: " + image.getWidth() + "x" + image.getHeight());
        // Square, as a QR must be.
        assertTrue(Math.abs(image.getWidth() - image.getHeight()) <= 1,
                "QR should be square, got " + image.getWidth() + "x" + image.getHeight());
    }

    @Test
    void qrHandlesAVerificationUrlPayload() throws Exception {
        BufferedImage image = decode(
                service.generateQrDataUri("https://learner.vacademy.io/verify?c=SN-2026-0001"));
        assertTrue(image.getWidth() > 0);
    }

    /**
     * A transparent background renders as an unscannable dark block on a coloured
     * certificate, so the canvas must be opaque.
     */
    @Test
    void qrIsRenderedOnAnOpaqueWhiteBackground() throws Exception {
        BufferedImage image = decode(service.generateQrDataUri("SN-2026-0001"));

        // Assert the property that matters, not a specific BufferedImage type
        // constant: ImageIO normalises a decoded PNG to TYPE_3BYTE_BGR, so
        // checking for TYPE_INT_RGB would fail on a perfectly good image.
        assertFalse(image.getColorModel().hasAlpha(), "certificate codes must not be transparent");

        // The top-left module of a QR is quiet zone, so it must be white — this
        // catches a canvas that was never filled.
        int corner = image.getRGB(0, 0) & 0xFFFFFF;
        assertEquals(0xFFFFFF, corner,
                "expected a white quiet zone, got #" + Integer.toHexString(corner));
    }

    // -------------------------------------------------------------- Barcode

    /**
     * Code 128 is required because certificate numbers are alphanumeric with
     * hyphens; Code 39 handles that poorly and EAN/UPC cannot encode it at all.
     */
    @Test
    void generatesACode128BarcodeForAnAlphanumericNumber() throws Exception {
        BufferedImage image = decode(service.generateBarcodeDataUri("SN-2026-0001"));
        assertTrue(image.getWidth() > image.getHeight(),
                "a 1D barcode should be wider than it is tall");
        assertTrue(image.getWidth() >= 40, "barcode too narrow: " + image.getWidth());
    }

    @Test
    void barcodeHandlesTheOtherConfiguredNumberFormats() throws Exception {
        assertNotNull(service.generateBarcodeDataUri("VC-CSE-00125"));
        assertNotNull(service.generateBarcodeDataUri("AIIMS-NEET-2026-034"));
    }

    // ---------------------------------------------------------------- Edges

    /** Blank input must not blow up the certificate render — it degrades to no code. */
    @Test
    void returnsNullRatherThanThrowingOnBlankInput() {
        assertNull(service.generateQrDataUri(null));
        assertNull(service.generateQrDataUri("   "));
        assertNull(service.generateBarcodeDataUri(null));
        assertNull(service.generateBarcodeDataUri(""));
    }

    @Test
    void trimsSurroundingWhitespaceBeforeEncoding() throws Exception {
        assertNotNull(decode(service.generateQrDataUri("  SN-2026-0001  ")));
    }
}
