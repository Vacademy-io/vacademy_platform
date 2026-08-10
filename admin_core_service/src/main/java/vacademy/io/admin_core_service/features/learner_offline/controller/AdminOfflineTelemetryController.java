package vacademy.io.admin_core_service.features.learner_offline.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDiscrepancyReviewRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDownloadTelemetryDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncDiscrepancyDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineSyncDiscrepancy;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineSyncDiscrepancyRepository;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDownloadStateService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

/** Admin discrepancy review + download telemetry (offline plan, Parts A4/A5). */
@RestController
@RequestMapping("/admin-core-service/admin/offline/v1")
@RequiredArgsConstructor
public class AdminOfflineTelemetryController {

    private final OfflineSyncDiscrepancyRepository offlineSyncDiscrepancyRepository;
    private final OfflineDownloadStateService offlineDownloadStateService;

    @GetMapping("/discrepancies")
    public ResponseEntity<Page<OfflineSyncDiscrepancyDTO>> listDiscrepancies(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(value = "packageSessionId", required = false) String packageSessionId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<OfflineSyncDiscrepancy> result;
        if (packageSessionId != null && status != null) {
            result = offlineSyncDiscrepancyRepository.findByPackageSessionIdAndStatus(packageSessionId, status,
                    pageable);
        } else if (packageSessionId != null) {
            result = offlineSyncDiscrepancyRepository.findByPackageSessionId(packageSessionId, pageable);
        } else if (status != null) {
            result = offlineSyncDiscrepancyRepository.findByStatus(status, pageable);
        } else {
            result = offlineSyncDiscrepancyRepository.findAll(pageable);
        }
        return ResponseEntity.ok(result.map(OfflineSyncDiscrepancyDTO::from));
    }

    @PutMapping("/discrepancies/{id}/review")
    public ResponseEntity<String> reviewDiscrepancy(@RequestAttribute("user") CustomUserDetails user,
            @PathVariable("id") String id, @RequestBody OfflineDiscrepancyReviewRequest request) {
        OfflineSyncDiscrepancy row = offlineSyncDiscrepancyRepository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Discrepancy not found"));
        row.setStatus(request != null && request.getStatus() != null ? request.getStatus() : "REVIEWED");
        offlineSyncDiscrepancyRepository.save(row);
        return ResponseEntity.ok("Discrepancy updated");
    }

    @GetMapping("/telemetry/downloads")
    public ResponseEntity<OfflineDownloadTelemetryDTO> downloadTelemetry(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("packageSessionId") String packageSessionId) {
        return ResponseEntity.ok(offlineDownloadStateService.getTelemetry(packageSessionId));
    }
}
