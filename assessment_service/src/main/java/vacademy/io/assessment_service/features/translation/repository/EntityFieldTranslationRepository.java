package vacademy.io.assessment_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.translation.entity.EntityFieldTranslation;

import java.util.List;
import java.util.Optional;

public interface EntityFieldTranslationRepository extends JpaRepository<EntityFieldTranslation, String> {

    /** Upsert lookup (unique key: entity_type + entity_id + field + locale). */
    Optional<EntityFieldTranslation> findByEntityTypeAndEntityIdAndFieldAndLocale(String entityType, String entityId,
            String field, String locale);

    /** One-shot fetch for delivery: servable rows for a set of entity ids of one type. */
    List<EntityFieldTranslation> findByEntityTypeAndEntityIdInAndLocaleAndStateIn(String entityType,
            List<String> entityIds, String locale, List<String> states);
}
