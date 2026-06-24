package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.learner_tracking.entity.LearnerSlideInteraction;

import java.util.List;
import java.util.Optional;

public interface LearnerSlideInteractionRepository extends JpaRepository<LearnerSlideInteraction, String> {
    List<LearnerSlideInteraction> findByUserIdAndSlideId(String userId, String slideId);

    Optional<LearnerSlideInteraction> findByUserIdAndSlideIdAndElementKey(String userId, String slideId,
            String elementKey);
}
