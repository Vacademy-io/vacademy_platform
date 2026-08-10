package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDownloadTelemetryDTO;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDownloadStateRepository;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Upserts offline_download_state from DOWNLOAD_STATE events on the offline
 * sync batch endpoint, and serves the admin telemetry rollup (offline plan,
 * Part A5). The repository-level upsert is clientTs-monotonic on its own
 * (see OfflineDownloadStateRepository.upsert's WHERE guard), so this service
 * stays a thin pass-through rather than re-implementing that comparison.
 */
@Service
@RequiredArgsConstructor
public class OfflineDownloadStateService {

    private final OfflineDownloadStateRepository offlineDownloadStateRepository;

    public void upsert(String deviceId, String userId, String packageSessionId, String slideId, String status,
            Long clientTsMillis) {
        Timestamp clientTs = clientTsMillis != null ? new Timestamp(clientTsMillis) : null;
        offlineDownloadStateRepository.upsert(UUID.randomUUID().toString(), deviceId, userId, packageSessionId,
                slideId, status, clientTs);
    }

    public OfflineDownloadTelemetryDTO getTelemetry(String packageSessionId) {
        long learners = offlineDownloadStateRepository.countLearnersWithDownloads(packageSessionId);
        long devices = offlineDownloadStateRepository.countActiveDevices(packageSessionId);
        Map<String, Long> perSlide = new LinkedHashMap<>();
        for (Object[] row : offlineDownloadStateRepository.countPerSlide(packageSessionId)) {
            perSlide.put((String) row[0], ((Number) row[1]).longValue());
        }
        return new OfflineDownloadTelemetryDTO(learners, devices, perSlide);
    }
}
