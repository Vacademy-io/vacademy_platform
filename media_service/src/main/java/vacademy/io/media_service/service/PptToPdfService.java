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

    // Scale factor for higher resolution (2x = ~144 DPI for standard slides)
    private static final double SCALE_FACTOR = 2.0;

    // JPEG quality for embedded images (0.0-1.0, higher = better quality but larger
    // file)
    private static final float JPEG_QUALITY = 0.95f;

    public byte[] convertPptToPdf(MultipartFile file) {
        try (SlideShow<?, ?> ppt = SlideShowFactory.create(file.getInputStream());
                PDDocument pdfDocument = new PDDocument()) {

            Dimension pgsize = ppt.getPageSize();

            // Calculate scaled dimensions for higher quality rendering
            int scaledWidth = (int) (pgsize.width * SCALE_FACTOR);
            int scaledHeight = (int) (pgsize.height * SCALE_FACTOR);

            for (Slide<?, ?> slide : ppt.getSlides()) {
                // Create high-resolution image with alpha support
                BufferedImage img = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = img.createGraphics();

                // Enable high-quality rendering hints
                graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                        RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
                graphics.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS,
                        RenderingHints.VALUE_FRACTIONALMETRICS_ON);
                graphics.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
                graphics.setRenderingHint(RenderingHints.KEY_COLOR_RENDERING,
                        RenderingHints.VALUE_COLOR_RENDER_QUALITY);

                // Clear background with white
                graphics.setPaint(Color.WHITE);
                graphics.fill(new Rectangle2D.Float(0, 0, scaledWidth, scaledHeight));

                // Scale the graphics context to render at higher resolution
                graphics.scale(SCALE_FACTOR, SCALE_FACTOR);

                // Draw slide to image
                slide.draw(graphics);
                graphics.dispose();

                // Create PDF page at original slide dimensions (72 DPI standard)
                PDPage pdfPage = new PDPage(new PDRectangle(pgsize.width, pgsize.height));
                pdfDocument.addPage(pdfPage);

                // Use JPEG compression with high quality for smaller file size
                PDImageXObject pdImage = JPEGFactory.createFromImage(pdfDocument, img, JPEG_QUALITY);

                try (PDPageContentStream contentStream = new PDPageContentStream(pdfDocument, pdfPage)) {
                    // Draw the high-res image scaled down to fit the page
                    contentStream.drawImage(pdImage, 0, 0, pgsize.width, pgsize.height);
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdfDocument.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new VacademyException("Failed to convert PPT to PDF: " + e.getMessage());
        }
    }

    /**
     * Convert PPT to PDF with custom scale factor for even higher quality
     * 
     * @param file        PowerPoint file
     * @param scaleFactor Scale multiplier (e.g., 3.0 for ~216 DPI)
     * @return PDF bytes
     */
    public byte[] convertPptToPdfHighQuality(MultipartFile file, double scaleFactor) {
        try (SlideShow<?, ?> ppt = SlideShowFactory.create(file.getInputStream());
                PDDocument pdfDocument = new PDDocument()) {

            Dimension pgsize = ppt.getPageSize();

            int scaledWidth = (int) (pgsize.width * scaleFactor);
            int scaledHeight = (int) (pgsize.height * scaleFactor);

            for (Slide<?, ?> slide : ppt.getSlides()) {
                BufferedImage img = new BufferedImage(scaledWidth, scaledHeight, BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = img.createGraphics();

                // Maximum quality rendering hints
                graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
                        RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
                graphics.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS,
                        RenderingHints.VALUE_FRACTIONALMETRICS_ON);
                graphics.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
                graphics.setRenderingHint(RenderingHints.KEY_COLOR_RENDERING,
                        RenderingHints.VALUE_COLOR_RENDER_QUALITY);

                graphics.setPaint(Color.WHITE);
                graphics.fill(new Rectangle2D.Float(0, 0, scaledWidth, scaledHeight));
                graphics.scale(scaleFactor, scaleFactor);
                slide.draw(graphics);
                graphics.dispose();

                PDPage pdfPage = new PDPage(new PDRectangle(pgsize.width, pgsize.height));
                pdfDocument.addPage(pdfPage);

                // Use lossless PNG for maximum quality (larger file size)
                PDImageXObject pdImage = JPEGFactory.createFromImage(pdfDocument, img, 1.0f);

                try (PDPageContentStream contentStream = new PDPageContentStream(pdfDocument, pdfPage)) {
                    contentStream.drawImage(pdImage, 0, 0, pgsize.width, pgsize.height);
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            pdfDocument.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new VacademyException("Failed to convert PPT to PDF: " + e.getMessage());
        }
    }
}
