package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineManifestVersionRepository;

import java.util.Collection;

/**
 * Bumps {@code offline_manifest_version} whenever something that could change
 * what a learner sees offline for a package session happens. Call sites (per
 * the offline plan, Part A2):
 *   1. Any offline_access_rule write/delete (OfflineAccessRuleService).
 *   2. SlideService.updateSlideStatus on transitions to/from PUBLISHED/DELETED.
 *   3. offlineDefaultEnabled toggling in PackageSettingService's COURSE_SETTING.
 *
 * <p>Each bump runs in its own REQUIRES_NEW transaction so a failure bumping
 * one package session's version (or the caller's outer transaction rolling
 * back for an unrelated reason) never blocks the others in a batch, and a
 * bump is never lost to a later rollback of its own triggering write.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OfflineManifestVersionService {

    private final OfflineManifestVersionRepository offlineManifestVersionRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void bump(String packageSessionId, String reason) {
        if (packageSessionId == null || packageSessionId.isBlank()) {
            return;
        }
        try {
            offlineManifestVersionRepository.bump(packageSessionId, reason);
        } catch (Exception e) {
            // Best-effort: a missed manifest bump only means a stale "no update
            // available" badge until the next mutation, never data loss/corruption.
            log.warn("Failed to bump offline manifest version for packageSessionId={}, reason={}: {}",
                    packageSessionId, reason, e.getMessage());
        }
    }

    public void bumpAll(Collection<String> packageSessionIds, String reason) {
        if (packageSessionIds == null) {
            return;
        }
        packageSessionIds.stream().distinct().forEach(id -> bump(id, reason));
    }

    public long getVersion(String packageSessionId) {
        return offlineManifestVersionRepository.findByPackageSessionId(packageSessionId)
                .map(v -> v.getVersion() == null ? 0L : v.getVersion())
                .orElse(0L);
    }
}
