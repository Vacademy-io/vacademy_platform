package vacademy.io.admin_core_service.features.common.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;

import java.util.List;
import java.util.Optional;

public interface CustomFieldValuesRepository extends JpaRepository<CustomFieldValues, String> {
    List<CustomFieldValues> findBySourceTypeAndSourceIdAndTypeAndTypeId(String sourceType, String sourceId, String type,
            String typeId);

    List<CustomFieldValues> findBySourceTypeAndSourceId(String sourceType, String sourceId);

    @Query("SELECT cfv FROM CustomFieldValues cfv " +
            "JOIN CustomFields cf ON cf.id = cfv.customFieldId " +
            "WHERE cfv.sourceId = :sourceId " +
            "AND cf.fieldKey = :fieldKey " +
            "AND cfv.sourceType = :sourceType")
    Optional<CustomFieldValues> findBySourceIdAndFieldKeyAndSourceType(
            @Param("sourceId") String sourceId,
            @Param("fieldKey") String fieldKey,
            @Param("sourceType") String sourceType);

    Optional<CustomFieldValues> findTopByCustomFieldIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
            String customFieldId,
            String sourceType,
            String sourceId);

    Optional<CustomFieldValues> findTopByCustomFieldIdAndSourceTypeAndSourceIdAndTypeAndTypeIdOrderByCreatedAtDesc(
            String customFieldId,
            String sourceType,
            String sourceId,
            String type,
            String typeId);
}
