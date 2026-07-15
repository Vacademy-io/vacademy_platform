package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionContentLink;

import java.util.List;
import java.util.Optional;

public interface LiveSessionContentLinkRepository extends JpaRepository<LiveSessionContentLink, String> {

    @Query("SELECT l FROM LiveSessionContentLink l WHERE l.sessionId = :sessionId AND l.status <> 'DELETED' " +
            "ORDER BY l.createdAt DESC")
    List<LiveSessionContentLink> findActiveBySessionId(@Param("sessionId") String sessionId);

    @Query("SELECT l FROM LiveSessionContentLink l WHERE l.scheduleId = :scheduleId " +
            "AND l.recordingId = :recordingId AND l.chapterId = :chapterId AND l.status <> 'DELETED'")
    Optional<LiveSessionContentLink> findActiveByScheduleAndRecordingAndChapter(
            @Param("scheduleId") String scheduleId,
            @Param("recordingId") String recordingId,
            @Param("chapterId") String chapterId);

    @Query("SELECT l FROM LiveSessionContentLink l WHERE l.scheduleId IN :scheduleIds " +
            "AND l.packageSessionId = :packageSessionId " +
            "AND l.contentType IN ('MATERIAL_PDF', 'MATERIAL_VIDEO') AND l.status <> 'DELETED'")
    List<LiveSessionContentLink> findActiveMaterialsForSchedulesAndBatch(
            @Param("scheduleIds") List<String> scheduleIds,
            @Param("packageSessionId") String packageSessionId);
}
