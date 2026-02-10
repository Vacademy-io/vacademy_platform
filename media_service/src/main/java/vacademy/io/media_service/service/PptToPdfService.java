package vacademy.io.media_service.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.poi.sl.usermodel.Slide;
import org.apache.poi.sl.usermodel.SlideShow;
import org.apache.poi.sl.usermodel.SlideShowFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.VacademyException;

import java.awt.*;
import java.awt.geom.Rectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
public class PptToPdfService {

    private static final Logger logger = LoggerFactory.getLogger(PptToPdfService.class);

    // Conservative scale to prevent OOM - 1.0 = native resolution
    private static final double STANDARD_SCALE = 1.0;
    private static final double HIGH_SCALE = 2;

    // JPEG quality (0.0-1.0)
    private static final float JPEG_QUALITY = 0.95f;

    public byte[] convertPptToPdf(MultipartFile file) {
        return convertPptToPdfWithScale(file, STANDARD_SCALE);
    }

    public byte[] convertPptToPdfHighQuality(MultipartFile file, double scaleFactor) {
        // Cap scale factor to prevent OOM
        double safeScale = Math.min(scaleFactor, HIGH_SCALE);
        return convertPptToPdfWithScale(file, safeScale);
    }

    private byte[] convertPptToPdfWithScale(MultipartFile file, double scaleFactor) {
        PDDocument pdfDocument = null;
        SlideShow<?, ?> ppt = null;

        try {
            ppt = SlideShowFactory.create(file.getInputStream());
            pdfDocument = new PDDocument();

            Dimension pgsize = ppt.getPageSize();
            int scaledWidth = (int) (pgsize.width * scaleFactor);
            int scaledHeight = (int) (pgsize.height * scaleFactor);

            int slideCount = 0;
            for (Slide<?, ?> ignored : ppt.getSlides()) {
                slideCount++;
            }

            logger.info("Converting PPT to PDF: {} slides, scale={}, image size={}x{}",
                    slideCount, scaleFactor, scaledWidth, scaledHeight);

            int slideIndex = 0;
            for (Slide<?, ?> slide : ppt.getSlides()) {
                slideIndex++;

                // Create and render image for this slide
                BufferedImage img = null;
                try {
                    img = renderSlideToImage(slide, scaledWidth, scaledHeight, scaleFactor);

                    // Create PDF page
                    PDPage pdfPage = new PDPage(new PDRectangle(pgsize.width, pgsize.height));
                    pdfDocument.addPage(pdfPage);

                    // Embed image into PDF
                    PDImageXObject pdImage = JPEGFactory.createFromImage(pdfDocument, img, JPEG_QUALITY);

                    try (PDPageContentStream contentStream = new PDPageContentStream(pdfDocument, pdfPage)) {
                        contentStream.drawImage(pdImage, 0, 0, pgsize.width, pgsize.height);
                    }
                } finally {
                    // Aggressively clean up memory after each slide
                    if (img != null) {
                        img.flush();
                        img = null;
                    }
                }

                // Force GC every 3 slides
                if (slideIndex % 3 == 0) {
                    System.gc();
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdfDocument.save(out);
            logger.info("PDF conversion complete: {} bytes", out.size());
            return out.toByteArray();

        } catch (IOException e) {
            logger.error("Failed to convert PPT to PDF", e);
            throw new VacademyException("Failed to convert PPT to PDF: " + e.getMessage());
        } finally {
            // Ensure resources are closed
            try {
                if (pdfDocument != null)
                    pdfDocument.close();
                if (ppt != null)
                    ppt.close();
            } catch (IOException ignored) {
            }
            System.gc();
        }
    }

    private BufferedImage renderSlideToImage(Slide<?, ?> slide, int width, int height, double scale) {
        // Use TYPE_3BYTE_BGR - more memory efficient
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_3BYTE_BGR);
        Graphics2D graphics = img.createGraphics();

        try {
            // Basic rendering hints - avoid expensive ones
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // White background
            graphics.setPaint(Color.WHITE);
            graphics.fill(new Rectangle2D.Float(0, 0, width, height));

            // Scale and render
            graphics.scale(scale, scale);
            slide.draw(graphics);
        } finally {
            graphics.dispose();
        }

        return img;
    }
}
