package vacademy.io.admin_core_service.features.learner_offline.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDownloadState;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public interface OfflineDownloadStateRepository extends JpaRepository<OfflineDownloadState, String> {

    Optional<OfflineDownloadState> findByDeviceIdAndSlideId(String deviceId, String slideId);

    /**
     * clientTs-monotonic upsert on (device_id, slide_id): only overwrites
     * when the incoming event is at least as recent as what is stored (or
     * nothing is stored yet / stored client_ts is null). A stale
     * DOWNLOAD_STATE replay can't undo a newer DELETED/DOWNLOADED state.
     */
    @Modifying
    @Query(value = """
            INSERT INTO offline_download_state
                (id, device_id, user_id, package_session_id, slide_id, status, client_ts, updated_at)
            VALUES
                (:id, :deviceId, :userId, :packageSessionId, :slideId, :status, :clientTs, CURRENT_TIMESTAMP)
            ON CONFLICT (device_id, slide_id) DO UPDATE SET
                status = EXCLUDED.status,
                client_ts = EXCLUDED.client_ts,
                package_session_id = EXCLUDED.package_session_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE offline_download_state.client_ts IS NULL
               OR EXCLUDED.client_ts IS NULL
               OR EXCLUDED.client_ts >= offline_download_state.client_ts
            """, nativeQuery = true)
    void upsert(@Param("id") String id,
            @Param("deviceId") String deviceId,
            @Param("userId") String userId,
            @Param("packageSessionId") String packageSessionId,
            @Param("slideId") String slideId,
            @Param("status") String status,
            @Param("clientTs") Timestamp clientTs);

    @Query("SELECT COUNT(DISTINCT s.userId) FROM OfflineDownloadState s "
            + "WHERE s.packageSessionId = :packageSessionId AND s.status = 'DOWNLOADED'")
    long countLearnersWithDownloads(@Param("packageSessionId") String packageSessionId);

    @Query("SELECT COUNT(DISTINCT s.deviceId) FROM OfflineDownloadState s "
            + "WHERE s.packageSessionId = :packageSessionId AND s.status = 'DOWNLOADED'")
    long countActiveDevices(@Param("packageSessionId") String packageSessionId);

    @Query("SELECT s.slideId, COUNT(DISTINCT s.deviceId) FROM OfflineDownloadState s "
            + "WHERE s.packageSessionId = :packageSessionId AND s.status = 'DOWNLOADED' GROUP BY s.slideId")
    List<Object[]> countPerSlide(@Param("packageSessionId") String packageSessionId);
}
