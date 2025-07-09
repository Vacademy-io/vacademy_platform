package vacademy.io.admin_core_service.features.learner_tracking.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.learner_tracking.entity.QuizSlideQuestionTracked;

public interface QuizSlideQuestionTrackedRepository extends JpaRepository<QuizSlideQuestionTracked, String> {
    @Modifying
    @Transactional
    @Query("DELETE FROM QuizSlideQuestionTracked qz WHERE qz.activityLog.id = :activityId")
    void deleteByActivityId(@Param("activityId") String activityId);
}
