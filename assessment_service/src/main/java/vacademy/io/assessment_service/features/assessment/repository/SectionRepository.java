package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.repository.CrudRepository;
import vacademy.io.assessment_service.features.assessment.entity.Section;

public interface SectionRepository extends CrudRepository<Section, String> {
}