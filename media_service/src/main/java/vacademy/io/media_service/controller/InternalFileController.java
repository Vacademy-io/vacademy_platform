package vacademy.io.media_service.controller;

import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/media_service/internal")
public class InternalFileController {
    @Autowired
    private FileService fileService;

    @GetMapping("/get-url/id")
    public ResponseEntity<String> getFileUrlById(@RequestAttribute("user") CustomUserDetails userDetails, @RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {
        String url = fileService.getUrlWithExpiryAndId(userDetails,fileId, expiryDays);
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-details/id")
    public ResponseEntity<FileDetailsDTO> getFileDetailsById(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileId, @RequestParam Integer expiryDays) throws FileDownloadException {
        FileDetailsDTO fileDetailsDTO = fileService.getFileDetailsWithExpiryAndId(userDetails,fileId, expiryDays);
        return ResponseEntity.ok(fileDetailsDTO);
    }

    @GetMapping("/get-details/ids")
    public ResponseEntity<List<FileDetailsDTO>> getFileDetailsByIds(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<FileDetailsDTO> fileDetailsDTO = fileService.getMultipleFileDetailsWithExpiryAndId(userDetails,fileIds, expiryDays);

        return ResponseEntity.ok(fileDetailsDTO);
    }

    @GetMapping("/get-url/id/many")
    public ResponseEntity<List<Map<String, String>>> getMultipleFileUrlById(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<Map<String, String>> url = fileService.getMultipleUrlWithExpiryAndId(userDetails,fileIds, expiryDays);
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url/id/many")
    public ResponseEntity<List<Map<String, String>>> getMultipleFilePublicUrlById(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String fileIds) throws FileDownloadException {
        List<Map<String, String>> url = fileService.getMultiplePublicUrlWithExpiryAndId(userDetails,fileIds);
        return ResponseEntity.ok(url);
    }

    @GetMapping("/get-public-url/source")
    public ResponseEntity<String> getFileUrlBySource(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam String source, @RequestParam String sourceId, @RequestParam Integer expiryDays) throws FileDownloadException {
        String url = fileService.getPublicUrlWithExpiryAndSource(userDetails,source, sourceId, expiryDays);
        return ResponseEntity.ok(url);
    }

    @PutMapping("/upload-file")
    public ResponseEntity<String> uploadFile(@RequestAttribute("user")CustomUserDetails userDetails,@RequestParam("file") MultipartFile file) {
        try {
            return ResponseEntity.ok(fileService.uploadFile(userDetails,file));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error uploading file: " + e.getMessage());
        }
    }

}