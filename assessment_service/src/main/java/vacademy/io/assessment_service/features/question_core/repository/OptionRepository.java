package vacademy.io.assessment_service.features.question_core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.question_core.entity.Option;

public interface OptionRepository extends JpaRepository<Option, String> {
}
