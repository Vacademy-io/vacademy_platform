package vacademy.io.media_service.controller;

import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.List;

@RestController
@RequestMapping("/media_service")
public class FileController {
    @Autowired
    private FileService fileService;

    @PostMapping("/get-signed-url")
    public ResponseEntity<PreSignedUrlResponse> uploadFile(@RequestAttribute("user") CustomUserDetails userDetails, @RequestBody PreSignedUrlRequest preSignedUrlRequest) {
        PreSignedUrlResponse url = fileService.getPreSignedUrl(userDetails,preSignedUrlRequest.getFileName(), preSignedUrlRequest.getFileType(), preSignedUrlRequest.getSource(), preSignedUrlRequest.getSourceId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url")
    public ResponseEntity<String> getFileUrl(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {

        String url = fileService.getUrlWithExpiryAndId(userDetails,fileId, expiryDays);
        return ResponseEntity.ok(url);
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Boolean> acknowledgeUpload(@RequestAttribute("user")CustomUserDetails userDetails,@RequestBody AcknowledgeRequest acknowledgeRequest) {
        return ResponseEntity.ok(fileService.acknowledgeClientUpload(userDetails,acknowledgeRequest));
    }

    @GetMapping("/get-details/ids")
    public ResponseEntity<List<FileDetailsDTO>> getFileDetailsByIds(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<FileDetailsDTO> fileDetailsDTO = fileService.getMultipleFileDetailsWithExpiryAndId(userDetails,fileIds, expiryDays);

        return ResponseEntity.ok(fileDetailsDTO);
    }

}