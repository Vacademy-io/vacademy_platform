package vacademy.io.admin_core_service.features.learner_offline.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineSyncEvent;

import java.sql.Timestamp;
import java.util.Optional;

@Repository
public interface OfflineSyncEventRepository extends JpaRepository<OfflineSyncEvent, String> {

    /**
     * Dedup insert: claims the clientEventId row with status=ACCEPTED unless
     * it already exists. Returns the number of rows inserted (0 or 1) so the
     * caller (OfflineSyncEventProcessor) can tell "first time" from
     * "already processed" without a separate SELECT.
     */
    @Modifying
    @Query(value = """
            INSERT INTO offline_sync_event
                (client_event_id, device_id, user_id, seq, client_ts, event_type, slide_id, package_session_id, status, processed_at)
            VALUES
                (:clientEventId, :deviceId, :userId, :seq, :clientTs, :eventType, :slideId, :packageSessionId, 'ACCEPTED', CURRENT_TIMESTAMP)
            ON CONFLICT (client_event_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(@Param("clientEventId") String clientEventId,
            @Param("deviceId") String deviceId,
            @Param("userId") String userId,
            @Param("seq") Long seq,
            @Param("clientTs") Timestamp clientTs,
            @Param("eventType") String eventType,
            @Param("slideId") String slideId,
            @Param("packageSessionId") String packageSessionId);

    @Modifying
    @Query("UPDATE OfflineSyncEvent e SET e.status = 'FAILED', e.errorCode = :errorCode, "
            + "e.processedAt = CURRENT_TIMESTAMP WHERE e.clientEventId = :clientEventId")
    void markFailed(@Param("clientEventId") String clientEventId, @Param("errorCode") String errorCode);

    @Modifying
    @Query("UPDATE OfflineSyncEvent e SET e.status = 'ACCEPTED', e.errorCode = NULL, "
            + "e.processedAt = CURRENT_TIMESTAMP WHERE e.clientEventId = :clientEventId")
    void markAccepted(@Param("clientEventId") String clientEventId);

    /**
     * Monotonic guard input (A4 step 2): the latest clientTs successfully
     * dispatched for this (device, slide) so far, ACCEPTED rows only. A
     * newly-arriving event with an older clientTs than this must not clobber
     * a last-write-wins learner_operation position.
     */
    @Query("SELECT MAX(e.clientTs) FROM OfflineSyncEvent e "
            + "WHERE e.deviceId = :deviceId AND e.slideId = :slideId AND e.status = 'ACCEPTED'")
    Timestamp findMaxAcceptedClientTs(@Param("deviceId") String deviceId, @Param("slideId") String slideId);

    Optional<OfflineSyncEvent> findByClientEventId(String clientEventId);
}
