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

        @GetMapping("/list")
        @ClientCacheable(maxAgeSeconds = 120, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
        public ResponseEntity<SystemFileListResponseDTO> getSystemFiles(
                        @Valid @RequestBody SystemFileListRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("GET /admin-core-service/system-files/v1/list - User: {}, Level: {}, LevelId: {}, AccessType: {}",
                                user.getUserId(), request.getLevel(), request.getLevelId(), request.getAccessType());

                SystemFileListResponseDTO response = systemFileService.getSystemFilesByAccess(request, instituteId,
                                user);

                return ResponseEntity.ok(response);
        }

        @GetMapping("/access")
        @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id"})
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

        @GetMapping("/my-files")
        @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
        public ResponseEntity<SystemFileListResponseDTO> getMyFiles(
                        @Valid @RequestBody MyFilesRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("GET /admin-core-service/system-files/v1/my-files - User: {}, Institute: {}, Roles: {}",
                                user.getUserId(), instituteId, request.getUserRoles());

                SystemFileListResponseDTO response = systemFileService.getMyFiles(request, instituteId, user);

                return ResponseEntity.ok(response);
        }
}
