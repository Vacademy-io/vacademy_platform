package vacademy.io.assessment_service.features.tags.entities.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.tags.entities.EntityTag;

public interface EntityTagCommunityRepository extends JpaRepository<EntityTag, String> {
}
