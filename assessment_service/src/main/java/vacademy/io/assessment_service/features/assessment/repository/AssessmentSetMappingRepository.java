package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentSetMapping;

import java.util.List;

@Repository
public interface AssessmentSetMappingRepository extends JpaRepository<AssessmentSetMapping, String> {

    List<AssessmentSetMapping> findByAssessmentIdAndStatusNotIn(String assessmentId, List<String> name);
}
