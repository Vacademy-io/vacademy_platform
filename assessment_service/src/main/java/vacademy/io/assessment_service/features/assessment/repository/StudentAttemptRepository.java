package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;

@Repository
public interface StudentAttemptRepository extends CrudRepository<StudentAttempt, String> {
}