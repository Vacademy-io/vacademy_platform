package labor.link.media_service.controller;

import labor.link.media_service.dto.PreSignedUrlRequest;
import labor.link.media_service.dto.PreSignedUrlResponse;
import labor.link.media_service.exceptions.FileDownloadException;
import labor.link.media_service.service.FileService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.List;

@RestController
@RequestMapping("/media")
public class FileController {
    @Autowired
    private FileService fileService;

    @PostMapping("/get-signed-url")
    public ResponseEntity<PreSignedUrlResponse> uploadFile(@RequestBody PreSignedUrlRequest preSignedUrlRequest) {
        PreSignedUrlResponse url = fileService.getPreSignedUrl(preSignedUrlRequest.getFileName(), preSignedUrlRequest.getFileType(), preSignedUrlRequest.getSource(), preSignedUrlRequest.getSourceId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url")
    public ResponseEntity<String> getFileUrl(@RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {

        String url = fileService.getUrlWithExpiryAndId(fileId, expiryDays);
        return ResponseEntity.ok(url);
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Boolean> acknowledgeUpload(@RequestParam String fileId, @RequestParam String fileSize) {
        return ResponseEntity.ok(fileService.acknowledgeClientUpload(fileId, Long.valueOf(fileSize)));
    }

    @GetMapping("/get-details/ids")
    public ResponseEntity<List<FileDetailsDTO>> getFileDetailsByIds(@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<FileDetailsDTO> fileDetailsDTO = fileService.getMultipleFileDetailsWithExpiryAndId(fileIds, expiryDays);

        return ResponseEntity.ok(fileDetailsDTO);
    }

}