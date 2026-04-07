package vacademy.io.admin_core_service.features.ota_update.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaCheckResponse;
import vacademy.io.admin_core_service.features.ota_update.service.OtaUpdateService;

@RestController
@RequestMapping("/admin-core-service/public/ota/v1")
@RequiredArgsConstructor
public class OtaUpdatePublicController {

    private final OtaUpdateService otaUpdateService;

    @GetMapping("/check")
    public ResponseEntity<OtaCheckResponse> checkForUpdate(
            @RequestParam String platform,
            @RequestParam String currentBundleVersion,
            @RequestParam String nativeVersion,
            @RequestParam(required = false) String appId) {
        OtaCheckResponse response = otaUpdateService.checkForUpdate(
                platform, currentBundleVersion, nativeVersion, appId);
        return ResponseEntity.ok(response);
    }
}
