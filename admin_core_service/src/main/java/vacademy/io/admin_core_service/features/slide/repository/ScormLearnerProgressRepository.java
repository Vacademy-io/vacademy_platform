package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.ScormLearnerProgress;

import java.util.Optional;

@Repository
public interface ScormLearnerProgressRepository extends JpaRepository<ScormLearnerProgress, String> {
    Optional<ScormLearnerProgress> findByUserIdAndSlideIdAndAttemptNumber(String userId, String slideId,
            Integer attemptNumber);

    Optional<ScormLearnerProgress> findTopByUserIdAndSlideIdOrderByAttemptNumberDesc(String userId, String slideId);
}
