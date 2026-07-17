package vacademy.io.admin_core_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.translation.dto.TranslationStateCountProjection;
import vacademy.io.admin_core_service.features.translation.entity.EntityFieldTranslation;

import java.util.List;
import java.util.Optional;

public interface EntityFieldTranslationRepository extends JpaRepository<EntityFieldTranslation, String> {

    Optional<EntityFieldTranslation> findByEntityTypeAndEntityIdAndFieldAndLocale(
            String entityType, String entityId, String field, String locale);

    /**
     * Counts entity-field translation rows by state for one (packageSession,
     * locale). Wave 1 covers SLIDE title/description, so the package-session
     * linkage is via the slides of the package session. READ-ONLY.
     */
    @Query(value = """
            SELECT eft.state AS state, COUNT(*) AS cnt
            FROM entity_field_translation eft
            WHERE eft.locale = :locale
              AND eft.entity_type = 'SLIDE'
              AND eft.entity_id IN (
                    SELECT s.id
                    FROM chapter_package_session_mapping cpsm
                    JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
                    JOIN slide s ON s.id = cts.slide_id AND s.status <> 'DELETED'
                    WHERE cpsm.package_session_id = :packageSessionId
                      AND cpsm.status <> 'DELETED'
              )
            GROUP BY eft.state
            """, nativeQuery = true)
    List<TranslationStateCountProjection> countByStateForPackageSession(
            @Param("packageSessionId") String packageSessionId,
            @Param("locale") String locale);
}
