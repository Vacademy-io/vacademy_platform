package vacademy.io.admin_core_service.features.ota_update.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaCheckResponse;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaRegisterRequest;
import vacademy.io.admin_core_service.features.ota_update.dto.OtaVersionDTO;
import vacademy.io.admin_core_service.features.ota_update.entity.OtaBundleVersion;
import vacademy.io.admin_core_service.features.ota_update.repository.OtaBundleVersionRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtaUpdateService {

    private final OtaBundleVersionRepository repository;

    public OtaCheckResponse checkForUpdate(String platform, String currentBundleVersion,
                                           String nativeVersion, String appId) {
        List<OtaBundleVersion> activeVersions = repository.findActiveVersionsForPlatform(platform.toUpperCase());

        for (OtaBundleVersion version : activeVersions) {
            // Check institute targeting
            if (version.getTargetAppIds() != null && !version.getTargetAppIds().isBlank()) {
                Set<String> targetIds = Arrays.stream(version.getTargetAppIds().split(","))
                        .map(String::trim)
                        .collect(Collectors.toSet());
                if (appId == null || !targetIds.contains(appId)) {
                    continue;
                }
            }

            // Check minimum native version compatibility
            if (compareVersions(nativeVersion, version.getMinNativeVersion()) < 0) {
                continue;
            }

            // Check if this version is newer than what the client has
            if (compareVersions(version.getVersion(), currentBundleVersion) > 0) {
                log.info("OTA update available: {} -> {} for platform={}, appId={}",
                        currentBundleVersion, version.getVersion(), platform, appId);
                return OtaCheckResponse.builder()
                        .updateAvailable(true)
                        .version(version.getVersion())
                        .bundleDownloadUrl(version.getBundleDownloadUrl())
                        .checksum(version.getChecksum())
                        .bundleSizeBytes(version.getBundleSizeBytes())
                        .forceUpdate(version.getForceUpdate())
                        .releaseNotes(version.getReleaseNotes())
                        .build();
            }
        }

        return OtaCheckResponse.noUpdate();
    }

    public OtaVersionDTO registerVersion(OtaRegisterRequest request, String publishedBy) {
        if (repository.findByVersion(request.getVersion()).isPresent()) {
            throw new IllegalArgumentException("Version " + request.getVersion() + " already exists");
        }

        OtaBundleVersion entity = OtaBundleVersion.builder()
                .version(request.getVersion())
                .platform(request.getPlatform() != null ? request.getPlatform().toUpperCase() : "ALL")
                .bundleFileId(request.getBundleFileId())
                .bundleDownloadUrl(request.getBundleDownloadUrl())
                .checksum(request.getChecksum())
                .bundleSizeBytes(request.getBundleSizeBytes())
                .minNativeVersion(request.getMinNativeVersion() != null ? request.getMinNativeVersion() : "1.0.0")
                .forceUpdate(request.getForceUpdate() != null ? request.getForceUpdate() : false)
                .targetAppIds(request.getTargetAppIds())
                .releaseNotes(request.getReleaseNotes())
                .publishedBy(publishedBy)
                .build();

        OtaBundleVersion saved = repository.save(entity);
        log.info("Registered OTA version {} by {}", saved.getVersion(), publishedBy);
        return OtaVersionDTO.fromEntity(saved);
    }

    public void deactivateVersion(String versionId) {
        OtaBundleVersion version = repository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Version not found: " + versionId));
        version.setIsActive(false);
        repository.save(version);
        log.info("Deactivated OTA version {}", version.getVersion());
    }

    public void activateVersion(String versionId) {
        OtaBundleVersion version = repository.findById(versionId)
                .orElseThrow(() -> new IllegalArgumentException("Version not found: " + versionId));
        version.setIsActive(true);
        repository.save(version);
        log.info("Activated OTA version {}", version.getVersion());
    }

    public Page<OtaVersionDTO> listVersions(Pageable pageable) {
        return repository.findAllByOrderByCreatedAtDesc(pageable).map(OtaVersionDTO::fromEntity);
    }

    /**
     * Compare two semver-like version strings (e.g. "2.1.6" vs "2.0.0").
     * Returns positive if v1 > v2, negative if v1 < v2, 0 if equal.
     */
    static int compareVersions(String v1, String v2) {
        if (v1 == null || v2 == null) return 0;

        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        int length = Math.max(parts1.length, parts2.length);

        for (int i = 0; i < length; i++) {
            int num1 = i < parts1.length ? parseIntSafe(parts1[i]) : 0;
            int num2 = i < parts2.length ? parseIntSafe(parts2[i]) : 0;
            if (num1 != num2) return num1 - num2;
        }
        return 0;
    }

    private static int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
