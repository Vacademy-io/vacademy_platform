package vacademy.io.admin_core_service.features.learner_offline.repository.projection;

import java.sql.Timestamp;

/** Row shape of {@code OfflineDownloadStateRepository#findLearnerDownloads}. */
public interface OfflineLearnerDownloadProjection {
    String getUserId();

    String getFullName();

    String getUsername();

    String getEmail();

    String getDeviceId();

    String getDeviceName();

    String getPlatform();

    String getDeviceStatus();

    Timestamp getLastCheckinAt();

    Timestamp getLeaseExpiresAt();

    long getDownloadedSlides();

    Timestamp getFirstDownloadedAt();

    Timestamp getLastDownloadedAt();
}
