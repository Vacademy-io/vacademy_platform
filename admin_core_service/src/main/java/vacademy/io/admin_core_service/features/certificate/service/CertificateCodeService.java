package vacademy.io.admin_core_service.features.certificate.service;

import com.itextpdf.barcodes.Barcode128;
import com.itextpdf.barcodes.BarcodeQRCode;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;

/**
 * Renders a certificate number as a scannable QR code or Code 128 barcode,
 * returned as a {@code data:image/png;base64,...} URI.
 *
 * <p><b>Why a data URI.</b> Certificates are rendered server-side by
 * openhtmltopdf ({@code PdfRendererBuilder}), not in a browser, so a JavaScript
 * QR library in the admin app cannot help — whatever the admin designs is
 * serialised to HTML and handed to the renderer. Embedding the image inline also
 * avoids an outbound HTTP fetch mid-render, which is already a weak point in
 * this pipeline (the default template pulls Google Fonts over the network).
 *
 * <p><b>Why iText and not ZXing.</b> {@code itext7-core} is already a declared
 * dependency and ships {@code barcodes}, so this needs no new library. ZXing is
 * present in the local Maven cache but is not declared in any pom, so relying on
 * it would mean depending on an undeclared transitive.
 *
 * <p>Both generators are best-effort: a failure returns null and the caller
 * substitutes an empty string, so a broken code never blocks certificate
 * delivery.
 */
@Slf4j
@Service
public class CertificateCodeService {

    /** Multiplier applied to the barcode's natural size so it stays crisp in print. */
    private static final int QR_SCALE = 4;
    private static final int BARCODE_SCALE = 3;

    /**
     * The white border every QR is required to have around it, in modules.
     *
     * <p>Four is what the QR specification calls for, and it is not decorative:
     * a scanner finds the symbol by its three corner patterns against blank
     * space. iText renders the bare matrix with no border at all, so a QR placed
     * on certificate artwork sat directly against the design and phones had to
     * be held just so. Printing it inside its quiet zone is the difference
     * between a code that scans and one that mostly scans.
     */
    private static final int QR_QUIET_ZONE_MODULES = 4;

    /**
     * The white border every Code 128 barcode is required to have, in modules
     * (one module = the width of the narrowest bar, "X").
     *
     * <p>The spec calls for at least 10X on each side. This used to be 0, on the
     * reasoning that "Code 128 carries its own start/stop patterns and iText
     * leaves a margin around them". Both halves of that are wrong: the start and
     * stop patterns are *data*, not blank space, and iText's
     * {@code createAwtImage} renders the bars edge-to-edge with no margin at all
     * — measured, the generated PNG had zero white pixel columns on either side.
     *
     * <p>The effect is worse than it sounds, because these barcodes are placed
     * on certificate artwork. With no quiet zone the first bar sits directly
     * against whatever the design puts there — on EduStream's template, a
     * dark globe — and the scanner has no blank margin to lock the symbol's
     * edges onto, so it never decodes.
     */
    private static final int BARCODE_QUIET_ZONE_MODULES = 10;

    /**
     * QR encoding the given payload, as a PNG data URI.
     *
     * @param payload usually the certificate number, or a public verification URL
     * @return data URI, or null when the payload is blank or generation fails
     */
    public String generateQrDataUri(String payload) {
        if (!StringUtils.hasText(payload)) {
            return null;
        }
        try {
            BarcodeQRCode qrCode = new BarcodeQRCode(payload.trim());
            Image awtImage = qrCode.createAwtImage(Color.BLACK, Color.WHITE);
            return toPngDataUri(awtImage, QR_SCALE, quietZonePixels(qrCode, awtImage));
        } catch (Exception e) {
            log.warn("Could not generate certificate QR code for payload of length {}",
                    payload.length(), e);
            return null;
        }
    }

    /**
     * Code 128 barcode, as a PNG data URI.
     *
     * <p>Code 128 is the right symbology here: certificate numbers are
     * alphanumeric with separators (e.g. {@code SN-2026-0001}), which Code 39
     * handles poorly and EAN/UPC cannot represent at all.
     */
    public String generateBarcodeDataUri(String payload) {
        if (!StringUtils.hasText(payload)) {
            return null;
        }
        // Barcode128's constructor requires a PdfDocument even though the AWT
        // rendering path never writes to it. A throwaway in-memory document
        // satisfies that without producing any file.
        try (ByteArrayOutputStream scratch = new ByteArrayOutputStream();
             PdfDocument throwaway = new PdfDocument(new PdfWriter(scratch))) {
            // A PdfDocument with no pages cannot be closed cleanly, so give it one.
            throwaway.addNewPage();
            Barcode128 barcode = new Barcode128(throwaway);
            barcode.setCode(payload.trim());
            Image awtImage = barcode.createAwtImage(Color.BLACK, Color.WHITE);
            return toPngDataUri(awtImage, BARCODE_SCALE, barcodeQuietZonePixels(awtImage));
        } catch (Exception e) {
            log.warn("Could not generate certificate barcode for payload of length {}",
                    payload.length(), e);
            return null;
        }
    }

    /**
     * Draw the AWT image onto an opaque white RGB canvas and encode as PNG.
     *
     * <p>The white background is deliberate — a transparent PNG renders as a
     * dark-on-dark block on a coloured certificate and stops scanning. Scaling
     * up keeps the modules sharp once the PDF is printed.
     */
    private String toPngDataUri(Image awtImage, int scale, int quietZone) throws Exception {
        int codeWidth = Math.max(1, awtImage.getWidth(null)) * scale;
        int codeHeight = Math.max(1, awtImage.getHeight(null)) * scale;
        int margin = Math.max(0, quietZone) * scale;
        int width = codeWidth + margin * 2;
        int height = codeHeight + margin * 2;

        BufferedImage buffered = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var graphics = buffered.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(awtImage, margin, margin, codeWidth, codeHeight, null);
        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (!ImageIO.write(buffered, "png", out)) {
                throw new IllegalStateException("No PNG writer available");
            }
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        }
    }

    /**
     * The barcode's quiet zone in source-image pixels: ten modules.
     *
     * <p>The module width is measured off the rendered symbol rather than
     * assumed. iText picks the bar width from {@code Barcode1D.getX()} and
     * rounds it into whole pixels when rasterising, so the only reliable
     * statement about "one module" is the narrowest run of same-coloured pixels
     * actually present in the image.
     */
    static int barcodeQuietZonePixels(Image awtImage) {
        try {
            return Math.max(1, narrowBarPixels(rasterise(awtImage))) * BARCODE_QUIET_ZONE_MODULES;
        } catch (Exception e) {
            log.warn("Could not measure the barcode module width; falling back to a nominal quiet zone", e);
            return BARCODE_QUIET_ZONE_MODULES;
        }
    }

    /** Draw an AWT image onto a plain white RGB raster so its pixels can be read. */
    private static BufferedImage rasterise(Image awtImage) {
        int w = Math.max(1, awtImage.getWidth(null));
        int h = Math.max(1, awtImage.getHeight(null));
        BufferedImage buffered = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = buffered.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, w, h);
            g.drawImage(awtImage, 0, 0, null);
        } finally {
            g.dispose();
        }
        return buffered;
    }

    /**
     * Width in pixels of the narrowest bar or space — one module.
     *
     * <p>Read across the vertical middle of the symbol, where every bar is
     * present, and take the shortest unbroken run of one colour.
     */
    private static int narrowBarPixels(BufferedImage image) {
        int y = image.getHeight() / 2;
        int narrowest = Integer.MAX_VALUE;
        int run = 0;
        boolean previousDark = isDark(image, 0, y);
        for (int x = 0; x < image.getWidth(); x++) {
            boolean dark = isDark(image, x, y);
            if (dark == previousDark) {
                run++;
            } else {
                narrowest = Math.min(narrowest, run);
                run = 1;
                previousDark = dark;
            }
        }
        narrowest = Math.min(narrowest, run);
        return narrowest == Integer.MAX_VALUE ? 1 : narrowest;
    }

    private static boolean isDark(BufferedImage image, int x, int y) {
        int rgb = image.getRGB(x, y);
        int luminance = (((rgb >> 16) & 0xFF) * 299 + ((rgb >> 8) & 0xFF) * 587 + (rgb & 0xFF) * 114) / 1000;
        return luminance < 128;
    }

    /**
     * The quiet zone in source-image pixels: four modules, measured from the
     * symbol itself rather than guessed as a percentage — the module count
     * changes with the payload, and a fixed percentage would be too thin for a
     * long verification URL and needlessly fat for a short number.
     *
     * @return 0 when the size cannot be read, which leaves the code exactly as
     *         it renders today rather than adding a margin of the wrong width
     */
    static int quietZonePixels(BarcodeQRCode qrCode, Image awtImage) {
        try {
            int modules = (int) Math.round(qrCode.getBarcodeSize().getWidth());
            int pixels = Math.max(1, awtImage.getWidth(null));
            if (modules <= 0 || pixels <= 0) {
                return 0;
            }
            return Math.max(1, Math.round((float) pixels / modules) * QR_QUIET_ZONE_MODULES);
        } catch (Exception e) {
            log.warn("Could not measure the QR symbol; rendering it without a quiet zone", e);
            return 0;
        }
    }
}
