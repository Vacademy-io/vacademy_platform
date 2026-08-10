package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * Why a slide is (not) downloadable in the offline manifest, after the
 * permission resolver AND the platform gate (S3-backed asset types only —
 * see OfflineAssetExtractor) have both been applied.
 */
public enum OfflineDownloadReason {
    ALLOWED,
    PERMISSION_DENIED,
    ONLINE_ONLY
}
