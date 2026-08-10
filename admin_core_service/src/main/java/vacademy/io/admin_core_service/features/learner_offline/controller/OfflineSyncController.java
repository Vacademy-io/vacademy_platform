package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSyncService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Offline plan Part A4: idempotent batched replay of tracking activity
 * recorded while a learner was offline. Lives under learner-tracking (not
 * learner-offline) because it dispatches into the existing tracking feature
 * package's services and shares that package's URL convention.
 */
@RestController
@RequestMapping("/admin-core-service/learner-tracking/offline-sync/v1")
@RequiredArgsConstructor
public class OfflineSyncController {

    private final OfflineSyncService offlineSyncService;

    @PostMapping("/batch")
    public ResponseEntity<OfflineSyncBatchResponseDTO> batch(@RequestAttribute("user") CustomUserDetails user,
            @RequestBody OfflineSyncBatchRequest request) {
        return ResponseEntity.ok(offlineSyncService.processBatch(request, user));
    }
}
