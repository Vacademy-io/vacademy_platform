package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDownloadUrlDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDownloadUrlsRequest;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDownloadUrlService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/** Offline plan Part A7 — see OfflineDownloadUrlService for the entitlement checks. */
@RestController
@RequestMapping("/admin-core-service/learner-offline/v1")
@RequiredArgsConstructor
public class LearnerOfflineDownloadUrlController {

    private final OfflineDownloadUrlService offlineDownloadUrlService;

    @PostMapping("/download-urls")
    public ResponseEntity<List<OfflineDownloadUrlDTO>> getDownloadUrls(@RequestAttribute("user") CustomUserDetails user,
            @RequestBody OfflineDownloadUrlsRequest request) {
        if (request == null || request.getPackageSessionId() == null) {
            throw new VacademyException("packageSessionId is required");
        }
        if (request.getDeviceId() == null || request.getDeviceId().isBlank()) {
            throw new VacademyException("deviceId is required");
        }
        return ResponseEntity.ok(offlineDownloadUrlService.getDownloadUrls(
                request.getPackageSessionId(), request.getDeviceId(), request.getFileIds(), user));
    }
}
