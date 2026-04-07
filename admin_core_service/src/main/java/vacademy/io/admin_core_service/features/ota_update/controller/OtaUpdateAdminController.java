package vacademy.io.admin_core_service.features.ota_update.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaRegisterRequest;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaVersionDTO;
import vacademy.io.admin_core_service.features.ota_update.service.OtaUpdateService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/admin/ota/v1")
@RequiredArgsConstructor
@Slf4j
public class OtaUpdateAdminController {

    private final OtaUpdateService otaUpdateService;

    @PostMapping("/register")
    public ResponseEntity<OtaVersionDTO> register(
            @RequestAttribute("user") CustomUserDetails user,
            @Valid @RequestBody OtaRegisterRequest request) {
        OtaVersionDTO result = otaUpdateService.registerVersion(request, user.getUserId());
        log.info("OTA version {} registered by user {}", request.getVersion(), user.getUserId());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/versions")
    public ResponseEntity<Page<OtaVersionDTO>> listVersions(
            @RequestAttribute("user") CustomUserDetails user,
            Pageable pageable) {
        return ResponseEntity.ok(otaUpdateService.listVersions(pageable));
    }

    @PutMapping("/{versionId}/deactivate")
    public ResponseEntity<String> deactivate(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String versionId) {
        otaUpdateService.deactivateVersion(versionId);
        log.info("OTA version {} deactivated by user {}", versionId, user.getUserId());
        return ResponseEntity.ok("Version deactivated");
    }

    @PutMapping("/{versionId}/activate")
    public ResponseEntity<String> activate(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable String versionId) {
        otaUpdateService.activateVersion(versionId);
        log.info("OTA version {} activated by user {}", versionId, user.getUserId());
        return ResponseEntity.ok("Version activated");
    }
}
