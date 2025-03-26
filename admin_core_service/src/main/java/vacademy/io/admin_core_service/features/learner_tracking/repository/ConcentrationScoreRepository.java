package vacademy.io.admin_core_service.features.learner_tracking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ConcentrationScore;

public interface ConcentrationScoreRepository extends JpaRepository<ConcentrationScore, String> {
}
