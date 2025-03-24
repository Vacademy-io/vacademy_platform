package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;

@Repository
public interface AssessmentUserAccessRepository extends JpaRepository<AssessmentUserRegistration, String> {
}
