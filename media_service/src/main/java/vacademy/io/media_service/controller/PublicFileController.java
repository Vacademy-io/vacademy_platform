package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.dto.PreSignedUrlRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;

@RestController
@RequestMapping("/media-service/public")
public class PublicFileController {

    @Autowired
    private FileService fileService;

    @Value("${aws.bucket.name}")
    private String bucketName;

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
        url = fileService.getPublicUrl(fileId, bucketName);

        HttpHeaders headers = new HttpHeaders();
        // Prevent caching anywhere to avoid stale pre-signed URLs being reused from
        // disk
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        headers.setPragma("no-cache");
        headers.setExpires(0);

        return ResponseEntity.ok().headers(headers).body(url);
    }

    @GetMapping("/get-details/id")
    public ResponseEntity<FileDetailsDTO> getFileDetailsById(@RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {
        FileDetailsDTO fileDetailsDTO = fileService.getFileDetailsWithExpiryAndId(fileId, expiryDays);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
        String etag = "W/\"" + fileId + ":" + expiryDays + "\"";
        headers.setETag(etag);
        return ResponseEntity.ok().headers(headers).body(fileDetailsDTO);
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
