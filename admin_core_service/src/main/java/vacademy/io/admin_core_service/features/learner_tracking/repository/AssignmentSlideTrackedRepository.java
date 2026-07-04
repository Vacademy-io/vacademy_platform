package vacademy.io.admin_core_service.features.learner_tracking.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AssignmentSlideTracked;

import java.sql.Timestamp;
import java.util.List;

public interface AssignmentSlideTrackedRepository extends JpaRepository<AssignmentSlideTracked,String> {
    @Modifying
    @Transactional
    @Query("DELETE FROM AssignmentSlideTracked a WHERE a.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);

    /**
     * Student report v2: a learner's assignment submissions in a date range, dated by
     * the submission itself ({@code assignment_slide_tracked.created_at}) rather than the
     * activity_log's created_at (which is the slide-open time and is NOT updated on
     * re-submission). JOIN FETCHes the parent activity log so {@code slideId} / userId
     * are usable in the collector's worker thread. READ-ONLY.
     */
    @Query("SELECT ast FROM AssignmentSlideTracked ast JOIN FETCH ast.activityLog a " +
           "WHERE a.userId = :userId AND ast.createdAt BETWEEN :start AND :end")
    List<AssignmentSlideTracked> findSubmissionsForUserInRange(
            @Param("userId") String userId,
            @Param("start") Timestamp start,
            @Param("end") Timestamp end);
}
