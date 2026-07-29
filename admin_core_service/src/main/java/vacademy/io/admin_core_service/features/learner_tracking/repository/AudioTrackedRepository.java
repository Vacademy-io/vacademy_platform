package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AudioTracked;

import java.util.List;

/**
 * Repository for AudioTracked entity operations.
 */
@Repository
public interface AudioTrackedRepository extends JpaRepository<AudioTracked, String> {

    /**
     * Find all audio tracked entries for an activity.
     */
    List<AudioTracked> findByActivityId(String activityId);

    /**
     * Delete all audio tracked entries for an activity.
     */
    @Modifying
    @Query("DELETE FROM AudioTracked a WHERE a.activityId = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);

    /**
     * Idempotent insert keyed on the client-supplied row id — same pattern as
     * document/video breadcrumbs. Replaces the historical delete-then-insert,
     * where a second tab or a retry deleted segments the first request had just
     * written and shrank the learner's distinct listened time. The WHERE guard
     * refuses to re-parent a row onto another activity.
     */
    @Modifying
    @Query(value = "INSERT INTO audio_tracked (id, activity_id, start_time, end_time, playback_speed) " +
            "VALUES (:id, :activityId, :startTime, :endTime, :playbackSpeed) " +
            "ON CONFLICT (id) DO UPDATE SET " +
            "start_time = EXCLUDED.start_time, " +
            "end_time = EXCLUDED.end_time, " +
            "playback_speed = EXCLUDED.playback_speed " +
            "WHERE audio_tracked.activity_id = EXCLUDED.activity_id", nativeQuery = true)
    void upsert(@Param("id") String id,
                @Param("activityId") String activityId,
                @Param("startTime") java.sql.Timestamp startTime,
                @Param("endTime") java.sql.Timestamp endTime,
                @Param("playbackSpeed") Double playbackSpeed);
}
