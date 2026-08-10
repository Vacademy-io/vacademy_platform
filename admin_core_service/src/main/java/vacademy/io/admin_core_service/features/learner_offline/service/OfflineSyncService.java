package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncEventRequestDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncEventResultDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Entry point for POST .../offline-sync/v1/batch (offline plan, Part A4).
 * Owns device resolution, batch-size limits and replay ordering; the actual
 * per-event dedup + dispatch happens in OfflineSyncEventProcessor, one
 * REQUIRES_NEW transaction per event, so this method itself does NOT need
 * (and must not carry) its own @Transactional -- wrapping the whole batch in
 * one transaction would defeat the point of per-event isolation.
 */
@Service
@RequiredArgsConstructor
public class OfflineSyncService {

    private static final int MAX_EVENTS_PER_BATCH = 100;

    private final OfflineDeviceRepository offlineDeviceRepository;
    private final OfflineSyncEventProcessor offlineSyncEventProcessor;

    public OfflineSyncBatchResponseDTO processBatch(OfflineSyncBatchRequest request, CustomUserDetails user) {
        if (request == null || request.getDeviceId() == null) {
            throw new VacademyException("deviceId is required");
        }
        List<OfflineSyncEventRequestDTO> events = request.getEvents() == null ? List.of() : request.getEvents();
        if (events.size() > MAX_EVENTS_PER_BATCH) {
            throw new VacademyException("At most " + MAX_EVENTS_PER_BATCH + " events per batch");
        }

        // Accept either the registration id or the client-reported device id,
        // same convention as OfflineDownloadUrlService.
        OfflineDevice device = offlineDeviceRepository.findByIdAndUserId(request.getDeviceId(), user.getUserId())
                .or(() -> offlineDeviceRepository.findByUserIdAndClientDeviceId(user.getUserId(),
                        request.getDeviceId()))
                .orElseThrow(() -> new VacademyException(HttpStatus.FORBIDDEN,
                        "No registered offline device for this user"));

        // A revoked device still gets its batch processed (don't lose learner
        // data) -- the client purges locally once it sees deviceStatus REVOKED.
        List<OfflineSyncEventRequestDTO> ordered = events.stream()
                .sorted(Comparator
                        .comparing((OfflineSyncEventRequestDTO e) -> e.getSeq() == null ? Long.MAX_VALUE : e.getSeq())
                        .thenComparing(e -> e.getClientTs() == null ? Long.MAX_VALUE : e.getClientTs()))
                .collect(Collectors.toList());

        List<OfflineSyncEventResultDTO> results = ordered.stream()
                .map(event -> offlineSyncEventProcessor.process(event, device.getId(), user))
                .collect(Collectors.toList());

        return new OfflineSyncBatchResponseDTO(device.getStatus(), results);
    }
}
