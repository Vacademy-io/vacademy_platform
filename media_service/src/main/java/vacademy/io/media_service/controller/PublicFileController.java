package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.media_service.dto.PreSignedUrlRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;

@RestController
@RequestMapping("/media-service/public")
public class PublicFileController {

    @Autowired
    private FileService fileService;

    @PostMapping("/get-signed-url")
    public ResponseEntity<PreSignedUrlResponse> uploadFile(@RequestBody PreSignedUrlRequest preSignedUrlRequest) {
        PreSignedUrlResponse url = fileService.getPublicPreSignedUrl(preSignedUrlRequest.getFileName(),
                preSignedUrlRequest.getFileType(), preSignedUrlRequest.getSource(), preSignedUrlRequest.getSourceId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url")
    public ResponseEntity<String> getFileUrl(@RequestParam String fileId,
            @RequestParam(required = false) Integer expiryDays,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) throws FileDownloadException {

        String url;

        // Generate permanent public URL without expiry
        url = fileService.getPublicUrl(fileId);

        HttpHeaders headers = new HttpHeaders();
        // Prevent caching anywhere to avoid stale pre-signed URLs being reused from
        // disk
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        headers.setPragma("no-cache");
        headers.setExpires(0);

        return ResponseEntity.ok().headers(headers).body(url);
    }

    @PutMapping("/upload-file")
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            return ResponseEntity.ok(fileService.uploadFile(file));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error uploading file: " + e.getMessage());
        }
    }

}
