package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDownloadUrlDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Offline plan Part A7: URL resolution for offline downloads. The manifest
 * only ever carries fileIds (never URLs, so they don't expire in a cached
 * manifest) — the client asks here, per batch, right before downloading.
 *
 * <p>Every requested fileId is checked against the learner's own currently
 * resolved offline manifest for that package session (enrollment +
 * OfflineAccessResolver permission + S3-backed platform gate all flow through
 * that one computation) before proxying to media_service, so nobody obtains
 * a signed URL for content they aren't entitled to. The caller must also hold
 * a registered ACTIVE offline device (Part A3) — URL issuance is the
 * entitlement gate in the no-server-key-custody design.
 */
@Service
@RequiredArgsConstructor
public class OfflineDownloadUrlService {

    private static final int MAX_FILE_IDS_PER_REQUEST = 50;
    private static final int SIGNED_URL_EXPIRY_DAYS = 1;

    private final OfflineManifestService offlineManifestService;
    private final MediaService mediaService;
    private final OfflineDeviceRepository offlineDeviceRepository;

    public List<OfflineDownloadUrlDTO> getDownloadUrls(String packageSessionId, String deviceId, List<String> fileIds,
            CustomUserDetails learner) {
        if (fileIds == null || fileIds.isEmpty()) {
            return List.of();
        }
        if (fileIds.size() > MAX_FILE_IDS_PER_REQUEST) {
            throw new VacademyException("At most " + MAX_FILE_IDS_PER_REQUEST + " fileIds per request");
        }

        // Accept either the registration id or the stable client device id.
        OfflineDevice device = offlineDeviceRepository.findByIdAndUserId(deviceId, learner.getUserId())
                .or(() -> offlineDeviceRepository.findByUserIdAndClientDeviceId(learner.getUserId(), deviceId))
                .orElseThrow(() -> new VacademyException(HttpStatus.FORBIDDEN,
                        "No registered offline device for this user"));
        if (device.getStatus() != OfflineDeviceStatus.ACTIVE) {
            throw new VacademyException(HttpStatus.FORBIDDEN, "Offline device is revoked");
        }

        Set<String> allowed = offlineManifestService.getDownloadableFileIds(packageSessionId, learner);
        List<String> notAllowed = fileIds.stream().filter(id -> !allowed.contains(id)).collect(Collectors.toList());
        if (!notAllowed.isEmpty()) {
            throw new VacademyException("Not entitled to download file(s): " + notAllowed);
        }

        List<Map<String, String>> urlMaps = mediaService.getMultipleFileDownloadUrls(fileIds, SIGNED_URL_EXPIRY_DAYS);
        return urlMaps.stream()
                .flatMap(m -> m.entrySet().stream())
                .map(e -> new OfflineDownloadUrlDTO(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }
}
