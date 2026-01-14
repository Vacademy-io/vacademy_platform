package vacademy.io.admin_core_service.features.system_files.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileAccessDetailsResponseDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileAddResponseDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileListRequestDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileListResponseDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileRequestDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileUpdateAccessRequestDTO;
import vacademy.io.admin_core_service.features.system_files.dto.SystemFileUpdateAccessResponseDTO;
import vacademy.io.admin_core_service.features.system_files.dto.MyFilesRequestDTO;
import vacademy.io.admin_core_service.features.system_files.dto.EmailAssetRequestDTO;
import vacademy.io.admin_core_service.features.system_files.dto.EmailAssetResponseDTO;
import vacademy.io.admin_core_service.features.system_files.dto.EmailAssetListResponseDTO;
import vacademy.io.admin_core_service.features.system_files.service.SystemFileService;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;
import vacademy.io.common.auth.model.CustomUserDetails;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/system-files/v1")
@RequiredArgsConstructor
public class SystemFileController {

        private final SystemFileService systemFileService;

        @PostMapping("/add")
        @CacheEvict(value = "systemFileList", allEntries = true)
        public ResponseEntity<SystemFileAddResponseDTO> addSystemFile(
                        @Valid @RequestBody SystemFileRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/system-files/v1/add - User: {}, Institute: {}, File: {}",
                                user.getUserId(), instituteId, request.getName());

                SystemFileAddResponseDTO response = systemFileService.addSystemFile(request, instituteId, user);

                return ResponseEntity.status(HttpStatus.CREATED).body(response);
        }

        @PostMapping("/list")
        @ClientCacheable(maxAgeSeconds = 120, scope = CacheScope.PRIVATE, varyHeaders = { "X-Institute-Id",
                        "X-User-Id" })
        public ResponseEntity<SystemFileListResponseDTO> getSystemFiles(
                        @Valid @RequestBody SystemFileListRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/system-files/v1/list - User: {}, Level: {}, LevelId: {}, AccessType: {}",
                                user.getUserId(), request.getLevel(), request.getLevelId(), request.getAccessType());

                SystemFileListResponseDTO response = systemFileService.getSystemFilesByAccess(request, instituteId,
                                user);

                return ResponseEntity.ok(response);
        }

        @GetMapping("/access")
        @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PRIVATE, varyHeaders = { "X-Institute-Id" })
        public ResponseEntity<SystemFileAccessDetailsResponseDTO> getSystemFileAccessDetails(
                        @RequestParam String systemFileId,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("GET /admin-core-service/system-files/v1/access - SystemFileId: {}, User: {}, Institute: {}",
                                systemFileId, user.getUserId(), instituteId);

                SystemFileAccessDetailsResponseDTO response = systemFileService.getSystemFileAccessDetails(systemFileId,
                                instituteId, user);

                return ResponseEntity.ok(response);
        }

        @PutMapping("/access")
        @CacheEvict(value = "systemFileAccess", allEntries = true)
        public ResponseEntity<SystemFileUpdateAccessResponseDTO> updateSystemFileAccess(
                        @Valid @RequestBody SystemFileUpdateAccessRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("PUT /admin-core-service/system-files/v1/access - SystemFileId: {}, User: {}, Institute: {}",
                                request.getSystemFileId(), user.getUserId(), instituteId);

                SystemFileUpdateAccessResponseDTO response = systemFileService.updateSystemFileAccess(request,
                                instituteId, user);

                return ResponseEntity.ok(response);
        }

        @PostMapping("/my-files")
        @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = { "X-Institute-Id",
                        "X-User-Id" })
        public ResponseEntity<SystemFileListResponseDTO> getMyFiles(
                        @Valid @RequestBody MyFilesRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/system-files/v1/my-files - User: {}, Institute: {}, Roles: {}",
                                user.getUserId(), instituteId, request.getUserRoles());

                SystemFileListResponseDTO response = systemFileService.getMyFiles(request, instituteId, user);

                return ResponseEntity.ok(response);
        }

        /**
         * Add an email asset (image/gif) for an institute
         * Email assets are automatically granted institute-level access
         */
        @PostMapping("/email-assets/add")
        @CacheEvict(value = "systemFileList", allEntries = true)
        public ResponseEntity<EmailAssetResponseDTO> addEmailAsset(
                        @Valid @RequestBody EmailAssetRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/system-files/v1/email-assets/add - User: {}, Institute: {}, Asset: {}",
                                user.getUserId(), instituteId, request.getName());

                EmailAssetResponseDTO response = systemFileService.addEmailAsset(request, instituteId, user);

                return ResponseEntity.status(HttpStatus.CREATED).body(response);
        }

        /**
         * Get all email assets for an institute
         * Returns all images/gifs stored as email assets with institute-level access
         */
        @GetMapping("/email-assets")
        @ClientCacheable(maxAgeSeconds = 120, scope = CacheScope.PRIVATE, varyHeaders = { "X-Institute-Id" })
        public ResponseEntity<EmailAssetListResponseDTO> getEmailAssets(
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("GET /admin-core-service/system-files/v1/email-assets - User: {}, Institute: {}",
                                user.getUserId(), instituteId);

                EmailAssetListResponseDTO response = systemFileService.getEmailAssetsByInstitute(instituteId, user);

                return ResponseEntity.ok(response);
        }
}
