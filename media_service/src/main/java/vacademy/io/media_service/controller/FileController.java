package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;

import java.util.List;

@RestController
@RequestMapping("/media-service")
public class FileController {
    @Autowired
    private FileService fileService;

    @Value("${aws.bucket.name}")
    private String bucketName;

    @PostMapping("/get-signed-url")
    public ResponseEntity<PreSignedUrlResponse> uploadFile(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody PreSignedUrlRequest preSignedUrlRequest) {
        PreSignedUrlResponse url = fileService.getPreSignedUrl(preSignedUrlRequest.getFileName(),
                preSignedUrlRequest.getFileType(), preSignedUrlRequest.getSource(), preSignedUrlRequest.getSourceId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url")
    public ResponseEntity<String> getFileUrl(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam String fileId,
            @RequestParam(required = false) Integer expiryDays,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) throws FileDownloadException {

        String url;

        // Generate permanent public URL without expiry
        url = fileService.getPublicUrl(fileId, bucketName);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        headers.setPragma("no-cache");
        headers.setExpires(0);

        return ResponseEntity.ok().headers(headers).body(url);
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Boolean> acknowledgeUpload(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody AcknowledgeRequest acknowledgeRequest) {
        return ResponseEntity.ok(fileService.acknowledgeClientUpload(acknowledgeRequest));
    }

    @GetMapping("/get-details/ids")
    public ResponseEntity<List<FileDetailsDTO>> getFileDetailsByIds(
            @RequestAttribute("user") CustomUserDetails userDetails, @RequestParam String fileIds,
            @RequestParam Integer expiryDays) throws FileDownloadException {
        List<FileDetailsDTO> fileDetailsDTO = fileService.getMultipleFileDetailsWithExpiryAndId(fileIds, expiryDays);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        headers.setPragma("no-cache");
        headers.setExpires(0);
        return ResponseEntity.ok().headers(headers).body(fileDetailsDTO);
    }

    @PostMapping("/acknowledge-get-details")
    public ResponseEntity<FileDetailsDTO> acknowledgeUploadAndGetDetails(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody AcknowledgeRequest acknowledgeRequest) {
        return ResponseEntity.ok(fileService.acknowledgeClientUploadAndGetPublicUrl(acknowledgeRequest));
    }

}