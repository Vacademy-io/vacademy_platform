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
            return toPngDataUri(awtImage, QR_SCALE);
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
            return toPngDataUri(awtImage, BARCODE_SCALE);
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
    private String toPngDataUri(Image awtImage, int scale) throws Exception {
        int width = Math.max(1, awtImage.getWidth(null)) * scale;
        int height = Math.max(1, awtImage.getHeight(null)) * scale;

        BufferedImage buffered = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var graphics = buffered.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(awtImage, 0, 0, width, height, null);
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
}
