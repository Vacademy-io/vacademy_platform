package vacademy.io.media_service.evaluation_ai.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;

import java.util.Optional;

public interface UserEvaluationRepository extends JpaRepository<EvaluationUser, String> {
    Optional<EvaluationUser> findBySourceTypeAndSourceIdAndUserId(String sourceType, String sourceId, String userId);
}
