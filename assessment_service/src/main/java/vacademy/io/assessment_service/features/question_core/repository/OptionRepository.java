package vacademy.io.assessment_service.features.question_core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.question_core.entity.Option;

import java.util.List;

public interface OptionRepository extends JpaRepository<Option, String> {

    List<Option> findByQuestionId(String questionId);
}
