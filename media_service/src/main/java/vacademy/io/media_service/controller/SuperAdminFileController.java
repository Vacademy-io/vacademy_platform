package vacademy.io.media_service.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.dto.SuperAdminFileItemDTO;
import vacademy.io.media_service.dto.SuperAdminPageResponse;
import vacademy.io.media_service.service.SuperAdminFileService;

import java.time.Instant;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/media-service/super-admin/v1/files")
@Slf4j
public class SuperAdminFileController {

    @Autowired
    private SuperAdminFileService superAdminFileService;

    @GetMapping
    public ResponseEntity<SuperAdminPageResponse<SuperAdminFileItemDTO>> searchFiles(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String sourceId,
            @RequestParam(required = false) Instant startDate,
            @RequestParam(required = false) Instant endDate,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "DESC") String sortDirection,
            @RequestParam(required = false) Integer expiryDays) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        if (size > 100) size = 100;
        return ResponseEntity.ok(superAdminFileService.searchFiles(page, size, search, fileType, source, sourceId,
                startDate == null ? null : Date.from(startDate),
                endDate == null ? null : Date.from(endDate),
                sortBy, sortDirection, expiryDays));
    }

    @GetMapping("/{fileId}/url")
    public ResponseEntity<Map<String, String>> getFileUrl(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String fileId,
            @RequestParam(required = false) Integer expiryDays) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(Map.of("url", superAdminFileService.getFileUrl(fileId, expiryDays)));
    }

    @PostMapping("/upload")
    public ResponseEntity<FileDetailsDTO> uploadFile(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "PRIVATE") String visibility) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        boolean isPublic = "PUBLIC".equalsIgnoreCase(visibility);
        return ResponseEntity.ok(superAdminFileService.uploadFile(file, isPublic, user.getUserId()));
    }

    @DeleteMapping("/{fileId}")
    public ResponseEntity<Map<String, String>> deleteFile(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String fileId) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        superAdminFileService.deleteFile(fileId);
        return ResponseEntity.ok(Map.of("message", "File deleted"));
    }
}
