package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;

public interface StudentAttemptRepository extends CrudRepository<StudentAttempt, String> {
}