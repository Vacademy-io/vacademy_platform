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
}
