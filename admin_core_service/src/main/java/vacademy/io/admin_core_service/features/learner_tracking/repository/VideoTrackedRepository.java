package vacademy.io.admin_core_service.features.learner_tracking.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.entity.VideoTracked;

public interface VideoTrackedRepository extends JpaRepository<VideoTracked,String> {
    @Modifying
    @Transactional
    @Query("DELETE FROM VideoTracked v WHERE v.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);
}
