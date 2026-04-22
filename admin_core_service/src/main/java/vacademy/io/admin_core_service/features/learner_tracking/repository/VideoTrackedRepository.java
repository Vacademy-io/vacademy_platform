package vacademy.io.admin_core_service.features.learner_tracking.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.entity.VideoTracked;

import java.sql.Timestamp;

public interface VideoTrackedRepository extends JpaRepository<VideoTracked, String> {
    @Modifying
    @Transactional
    @Query("DELETE FROM VideoTracked v WHERE v.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);

    /**
     * Idempotent insert keyed on the client-supplied row id. Avoids the
     * unique-constraint violation that surfaces when concurrent requests
     * for the same activity (e.g. duplicate FE submissions, multiple tabs)
     * race the historical delete-then-insert path.
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO public.video_tracked (id, activity_id, start_time, end_time) " +
            "VALUES (:id, :activityId, :startTime, :endTime) " +
            "ON CONFLICT (id) DO UPDATE SET " +
            "activity_id = EXCLUDED.activity_id, " +
            "start_time = EXCLUDED.start_time, " +
            "end_time = EXCLUDED.end_time", nativeQuery = true)
    void upsert(@Param("id") String id,
                @Param("activityId") String activityId,
                @Param("startTime") Timestamp startTime,
                @Param("endTime") Timestamp endTime);
}