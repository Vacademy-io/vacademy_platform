package vacademy.io.media_service.controller;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
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
}
