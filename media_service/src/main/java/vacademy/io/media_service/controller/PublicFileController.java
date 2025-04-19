package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
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
        PreSignedUrlResponse url = fileService.getPublicPreSignedUrl(preSignedUrlRequest.getFileName(), preSignedUrlRequest.getFileType(), preSignedUrlRequest.getSource(), preSignedUrlRequest.getSourceId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url")
    public ResponseEntity<String> getFileUrl(@RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {

        String url = fileService.getUrlWithExpiryAndId(fileId, expiryDays);
        return ResponseEntity.ok(url);
    }

}
