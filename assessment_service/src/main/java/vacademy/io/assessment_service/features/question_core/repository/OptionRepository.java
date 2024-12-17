package vacademy.io.assessment_service.features.question_core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;

public interface OptionRepository extends JpaRepository<Option, String> {
}
