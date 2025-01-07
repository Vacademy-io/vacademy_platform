package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.Section;

import java.util.Optional;

public interface SectionRepository extends CrudRepository<Section, String> {
}