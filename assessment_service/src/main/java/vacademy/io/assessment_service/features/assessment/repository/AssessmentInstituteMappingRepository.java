package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;

import java.util.Optional;

public interface AssessmentInstituteMappingRepository extends CrudRepository<AssessmentInstituteMapping, String> {

    Optional<AssessmentInstituteMapping> findTopByAssessmentUrl(String assessmentUrl);

    Optional<AssessmentInstituteMapping> findByAssessmentIdAndInstituteId(String assessmentId, String instituteId);

    // Resolve the owning institute for an assessment without knowing it up front
    // (used by the internal batch-registration endpoint). "AssessmentId" resolves
    // to the nested assessment.id, same as findByAssessmentIdAndInstituteId above.
    Optional<AssessmentInstituteMapping> findTopByAssessmentId(String assessmentId);
}