package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;

import java.util.Optional;

public interface AssessmentInstituteMappingRepository extends CrudRepository<AssessmentInstituteMapping, String> {

    Optional<AssessmentInstituteMapping> findTopByAssessmentUrl(String assessmentUrl);
}