package vacademy.io.media_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.service.FileService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/media-service/internal")
public class InternalFileController {
    @Autowired
    private FileService fileService;

    @GetMapping("/get-url/id")
    public ResponseEntity<String> getFileUrlById(@RequestParam String fileId,
                                                 @RequestParam Integer expiryDays,
                                                 @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) throws FileDownloadException {
        String url = fileService.getUrlWithExpiryAndId(fileId, expiryDays);

        String etag = "W/\"" + fileId + ":" + expiryDays + "\"";
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=60");
        headers.setETag(etag);

        if (etag.equals(ifNoneMatch)) {
            return new ResponseEntity<>(null, headers, HttpStatus.NOT_MODIFIED);
        }

        return ResponseEntity.ok().headers(headers).body(url);
    }

    @GetMapping("/public-url")
    public ResponseEntity<String> getPublicFileUrlById(@RequestParam("fileId") String fileId,
                                                       @RequestParam("expiryDays") Integer expiryDays,
                                                       @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) throws FileDownloadException {
        String url = fileService.getPublicBucketUrl(fileId, expiryDays);

        String etag = "W/\"" + fileId + ":" + expiryDays + "\"";
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=60");
        headers.setETag(etag);

        if (etag.equals(ifNoneMatch)) {
            return new ResponseEntity<>(null, headers, HttpStatus.NOT_MODIFIED);
        }

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

    @GetMapping("/get-details/ids")
    public ResponseEntity<List<FileDetailsDTO>> getFileDetailsByIds(@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<FileDetailsDTO> fileDetailsDTO = fileService.getMultipleFileDetailsWithExpiryAndId(fileIds, expiryDays);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
        String etag = "W/\"" + fileIds + ":" + expiryDays + "\"";
        headers.setETag(etag);
        return ResponseEntity.ok().headers(headers).body(fileDetailsDTO);
    }

    @GetMapping("/get-url/id/many")
    public ResponseEntity<List<Map<String, String>>> getMultipleFileUrlById(@RequestParam String fileIds, @RequestParam Integer expiryDays) throws FileDownloadException {
        List<Map<String, String>> url = fileService.getMultipleUrlWithExpiryAndId(fileIds, expiryDays);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=60");
        String etag = "W/\"" + fileIds + ":" + expiryDays + "\"";
        headers.setETag(etag);
        return ResponseEntity.ok().headers(headers).body(url);
    }

    @GetMapping("/get-public-url/id/many")
    public ResponseEntity<List<Map<String, String>>> getMultipleFilePublicUrlById(@RequestParam String fileIds) throws FileDownloadException {
        List<Map<String, String>> url = fileService.getMultiplePublicUrlWithExpiryAndId(fileIds);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=60");
        String etag = "W/\"" + fileIds + ":public\"";
        headers.setETag(etag);
        return ResponseEntity.ok().headers(headers).body(url);
    }

    @GetMapping("/get-public-url/source")
    public ResponseEntity<String> getFileUrlBySource(@RequestParam String source, @RequestParam String sourceId, @RequestParam Integer expiryDays) throws FileDownloadException {
        String url = fileService.getPublicUrlWithExpiryAndSource(source, sourceId, expiryDays);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=60");
        String etag = "W/\"" + source + ":" + sourceId + ":" + expiryDays + "\"";
        headers.setETag(etag);
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

    @PostMapping("/upload-file-v2")
    public ResponseEntity<FileDetailsDTO> uploadFileToAws(@RequestParam("file") MultipartFile file) {
        try {
            return ResponseEntity.ok(fileService.uploadFileWithDetails(file));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new FileDetailsDTO());
        }
    }

}