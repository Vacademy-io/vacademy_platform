package vacademy.io.admin_core_service.features.certificate.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.certificate.dto.VerificationDocumentUploadDto;
import vacademy.io.common.media.dto.InMemoryMultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.exceptions.VacademyException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

/**
 * Turns an admin's uploaded verification document into something the visual
 * editor can lay fields on.
 *
 * <p><b>Why a PDF has to become an image.</b> The editor positions {@code {{TOKEN}}}
 * fields absolutely over a background, exactly as the certificate designer does.
 * A PDF has no such canvas — there is no way to drop a field "onto page 1" of a
 * PDF in a browser. Rasterising the first page gives the editor the same kind of
 * background artwork a certificate template already uses, so dragging and mapping
 * work identically for an uploaded PDF and an uploaded image.
 *
 * <p>The uploaded PDF itself is kept only when the institute wants it served
 * verbatim ({@code verificationDocumentType=PDF}); once fields are laid on top,
 * the document is HTML with a PDF-derived background and is rendered through the
 * same pipeline as a certificate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationDocumentService {

    private final MediaService mediaService;

    /**
     * Rendering resolution for the background.
     *
     * <p>150 DPI is the point where text in the artwork still looks crisp at
     * print size without producing a background so large it slows the editor.
     * The certificate canvas is 1684px wide for a 445mm page — an A4 landscape
     * page at 150 DPI lands in the same neighbourhood, so the field coordinates
     * an admin drags out are in a familiar range.
     */
    private static final int BACKGROUND_DPI = 150;

    /** Guards against a huge upload turning into an unusable canvas. */
    private static final int MAX_BACKGROUND_PX = 4000;

    /**
     * Rasterise page one of an uploaded PDF and store it as the editor's canvas.
     *
     * @return the background's file id and pixel size, so the editor can set up a
     *         canvas of the right aspect and place fields in its coordinates
     */
    public VerificationDocumentUploadDto toEditableBackground(MultipartFile pdf) {
        if (pdf == null || pdf.isEmpty()) {
            throw new VacademyException("No file was uploaded");
        }
        try (PDDocument document = PDDocument.load(pdf.getInputStream())) {
            if (document.getNumberOfPages() == 0) {
                throw new VacademyException("That PDF has no pages");
            }
            // Only page one. A verification document is a single certificate-like
            // sheet; laying fields across several pages is a different feature and
            // silently using page 1 of a 40-page upload would be a worse surprise
            // than saying so.
            if (document.getNumberOfPages() > 1) {
                log.info("Verification document PDF has {} pages; only the first becomes the canvas",
                        document.getNumberOfPages());
            }

            BufferedImage page = new PDFRenderer(document).renderImageWithDPI(0, BACKGROUND_DPI);
            if (page.getWidth() > MAX_BACKGROUND_PX || page.getHeight() > MAX_BACKGROUND_PX) {
                throw new VacademyException(
                        "That page is too large to edit — please upload a page no bigger than A3");
            }

            PDPage first = document.getPage(0);
            float widthMm = first.getMediaBox().getWidth() / 72f * 25.4f;
            float heightMm = first.getMediaBox().getHeight() / 72f * 25.4f;

            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(page, "png", png);

            FileDetailsDTO stored = mediaService.uploadFileV2(new InMemoryMultipartFile(
                    "verification-background",
                    "verification-background.png",
                    "image/png",
                    png.toByteArray()));

            if (stored == null || stored.getId() == null) {
                throw new VacademyException("Could not store the page image for editing");
            }

            return VerificationDocumentUploadDto.builder()
                    .backgroundFileId(stored.getId())
                    .backgroundUrl(stored.getUrl())
                    .widthPx(page.getWidth())
                    .heightPx(page.getHeight())
                    .pageWidthMm(Math.round(widthMm))
                    .pageHeightMm(Math.round(heightMm))
                    .pageCount(document.getNumberOfPages())
                    .build();

        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            // An unreadable or encrypted PDF is an admin mistake, not a server
            // fault — say which so they can re-export it.
            log.warn("Could not read an uploaded verification PDF", e);
            throw new VacademyException("That PDF could not be read. If it is password protected, "
                    + "remove the protection and upload it again.");
        }
    }
}
