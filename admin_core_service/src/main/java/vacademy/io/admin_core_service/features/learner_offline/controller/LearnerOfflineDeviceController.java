package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceRegisterRequest;
import vacademy.io.admin_core_service.features.learner_offline.exception.OfflineDeviceLimitExceededException;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineCheckInService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDeviceService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;

/**
 * Learner-facing device registry endpoints (offline plan, Part A3). deviceId
 * path/body values here are offline_device.id (the server-issued row id), NOT
 * the client's clientDeviceId -- see OfflineDeviceRegisterRequest.deviceId for
 * the one exception (register's request body uses the client-reported
 * Capacitor Device.getId() to key reactivation).
 *
 * <p>instituteId is not carried on CustomUserDetails (unlike a packageSessionId
 * request, a device isn't scoped to one course to derive it from an enrollment
 * lookup), so it is taken as a request param here -- mirroring
 * AdminOfflineAccessController's existing instituteId-as-param convention for
 * writes that can't derive institute scope from the request body alone.
 */
@RestController
@RequestMapping("/admin-core-service/learner-offline/v1")
@RequiredArgsConstructor
public class LearnerOfflineDeviceController {

    private final OfflineDeviceService offlineDeviceService;
    private final OfflineCheckInService offlineCheckInService;

    @PostMapping("/devices/register")
    public ResponseEntity<OfflineDeviceDTO> register(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody OfflineDeviceRegisterRequest request) {
        if (request == null || request.getDeviceId() == null) {
            throw new VacademyException("deviceId is required");
        }
        return ResponseEntity.ok(offlineDeviceService.register(user.getUserId(), instituteId,
                request.getDeviceName(), request.getPlatform(), request.getDeviceId()));
    }

    @GetMapping("/devices")
    public ResponseEntity<List<OfflineDeviceDTO>> list(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(offlineDeviceService.list(user.getUserId(), instituteId));
    }

    @DeleteMapping("/devices/{id}")
    public ResponseEntity<String> revoke(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable("id") String deviceId) {
        offlineDeviceService.selfRevoke(user.getUserId(), deviceId);
        return ResponseEntity.ok("Device revoked");
    }

    @PostMapping("/devices/{id}/check-in")
    public ResponseEntity<OfflineCheckInResponseDTO> checkIn(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable("id") String deviceId,
            @RequestBody OfflineCheckInRequest request) {
        return ResponseEntity.ok(offlineCheckInService.checkIn(user.getUserId(), deviceId, request));
    }

    /**
     * Device-cap 409: surfaces DEVICE_LIMIT_REACHED + the caller's current
     * device list in the body so the client can offer "remove a device" UX.
     * Handled locally (rather than in the shared GlobalExceptionHandler,
     * which only ever returns the fixed ErrorInfo{url, ex, responseCode,
     * date} shape) because this is the one offline error the client needs
     * structured data from, not just a message.
     */
    @ExceptionHandler(OfflineDeviceLimitExceededException.class)
    public ResponseEntity<Map<String, Object>> handleDeviceLimitExceeded(OfflineDeviceLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", OfflineDeviceLimitExceededException.CODE,
                "message", ex.getMessage(),
                "devices", ex.getDevices()));
    }
}
