package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceRevokeRequest;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDeviceService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/** Admin device management (offline plan, Part A3). */
@RestController
@RequestMapping("/admin-core-service/admin/offline/v1")
@RequiredArgsConstructor
public class AdminOfflineDeviceController {

    private final OfflineDeviceService offlineDeviceService;

    @GetMapping("/devices")
    public ResponseEntity<List<OfflineDeviceDTO>> listDevicesForUser(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("userId") String userId) {
        return ResponseEntity.ok(offlineDeviceService.listForAdmin(userId));
    }

    @PostMapping("/devices/{id}/revoke")
    public ResponseEntity<String> revokeDevice(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable("id") String deviceId,
            @RequestBody(required = false) OfflineDeviceRevokeRequest request) {
        String reason = request != null ? request.getReason() : null;
        offlineDeviceService.adminRevoke(deviceId, reason, user.getUserId());
        return ResponseEntity.ok("Device revoked");
    }
}
