package vacademy.io.media_service.controller;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.PptToPdfByIdRequest;
import vacademy.io.media_service.service.PptToPdfService;

@RestController
@RequestMapping("/media-service/convert")
public class PptToPdfController {

    private final PptToPdfService pptToPdfService;

    public PptToPdfController(PptToPdfService pptToPdfService) {
        this.pptToPdfService = pptToPdfService;
    }

    /**
     * Convert PowerPoint file to PDF
     * 
     * @param file    PowerPoint file (.ppt or .pptx)
     * @param quality Optional quality setting: "standard" (default, 2x scale) or
     *                "high" (3x scale)
     * @return PDF file
     */
    @PostMapping("/ppt-to-pdf")
    public ResponseEntity<byte[]> convertPptToPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "quality", required = false, defaultValue = "standard") String quality) {

        byte[] pdfContent;
        if ("high".equalsIgnoreCase(quality)) {
            pdfContent = pptToPdfService.convertPptToPdfHighQuality(file, 3.0);
        } else {
            pdfContent = pptToPdfService.convertPptToPdf(file);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String filename = file.getOriginalFilename();
        if (filename != null && filename.lastIndexOf('.') > 0) {
            filename = filename.substring(0, filename.lastIndexOf('.'));
        } else {
            filename = "converted";
        }
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename + ".pdf").build());

        return new ResponseEntity<>(pdfContent, headers, HttpStatus.OK);
    }

    /**
     * Convert an already-uploaded PowerPoint file (referenced by its media-service
     * fileId) to PDF.
     *
     * <p>The client uploads the presentation straight to S3 via a pre-signed URL,
     * then calls this endpoint with the resulting fileId. The request body is tiny
     * (just the id), so it is not subject to the nginx/Spring request-size limit
     * that the multipart {@link #convertPptToPdf} endpoint runs into for large decks.
     *
     * @param request fileId (required) + original fileName (for format detection)
     * @param quality Optional quality setting (kept for API compatibility)
     * @return PDF file
     */
    @PostMapping("/ppt-to-pdf-by-id")
    public ResponseEntity<byte[]> convertPptToPdfById(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody PptToPdfByIdRequest request,
            @RequestParam(value = "quality", required = false, defaultValue = "standard") String quality) {

        byte[] pdfContent = pptToPdfService.convertPptToPdfByFileId(request.getFileId(), request.getFileName());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        String filename = request.getFileName();
        if (filename != null && filename.lastIndexOf('.') > 0) {
            filename = filename.substring(0, filename.lastIndexOf('.'));
        } else {
            filename = "converted";
        }
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename + ".pdf").build());

        return new ResponseEntity<>(pdfContent, headers, HttpStatus.OK);
    }
}
