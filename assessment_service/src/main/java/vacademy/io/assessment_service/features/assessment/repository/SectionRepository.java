package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.Section;

import java.util.List;

public interface SectionRepository extends CrudRepository<Section, String> {

    List<Section> findByAssessmentIdAndStatusNotIn(String assessmentId, List<String> status);
}