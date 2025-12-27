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

    /**
     * Find custom field values by source type and list of source IDs
     */
    @Query("SELECT cfv FROM CustomFieldValues cfv WHERE cfv.sourceType = :sourceType AND cfv.sourceId IN :sourceIds")
    List<CustomFieldValues> findBySourceTypeAndSourceIdIn(
            @Param("sourceType") String sourceType,
            @Param("sourceIds") List<String> sourceIds);

    /**
     * Find custom field values by phone number value
     * Returns all records where value matches the phone number (for phone lookup)
     */
    @Query("SELECT cfv FROM CustomFieldValues cfv WHERE cfv.value = :phoneNumber ORDER BY cfv.createdAt DESC")
    List<CustomFieldValues> findByPhoneNumber(@Param("phoneNumber") String phoneNumber);

    /**
     * Find custom field values with field metadata by user IDs
     * Returns: [sourceId, customFieldId, fieldKey, fieldName, fieldType, value, sourceType]
     */
    @Query("SELECT cfv.sourceId, cf.id, cf.fieldKey, cf.fieldName, cf.fieldType, cfv.value, cfv.sourceType " +
           "FROM CustomFieldValues cfv " +
           "JOIN CustomFields cf ON cf.id = cfv.customFieldId " +
           "WHERE cfv.sourceType = :sourceType AND cfv.sourceId IN :userIds " +
           "ORDER BY cfv.sourceId, cf.formOrder, cfv.createdAt DESC")
    List<Object[]> findCustomFieldsWithKeysByUserIds(
            @Param("sourceType") String sourceType,
            @Param("userIds") List<String> userIds);

    /**
     * Find custom field values with field metadata by user IDs and institute
     * Only returns custom fields that are active in institute_custom_fields for the given institute
     * Returns: [sourceId, customFieldId, fieldKey, fieldName, fieldType, value, sourceType]
     */
    @Query("SELECT cfv.sourceId, cf.id, cf.fieldKey, cf.fieldName, cf.fieldType, cfv.value, cfv.sourceType " +
           "FROM CustomFieldValues cfv " +
           "JOIN CustomFields cf ON cf.id = cfv.customFieldId " +
           "JOIN InstituteCustomField icf ON icf.customFieldId = cf.id AND icf.instituteId = :instituteId " +
           "WHERE cfv.sourceType = :sourceType AND cfv.sourceId IN :userIds " +
           "ORDER BY cfv.sourceId, cfv.createdAt DESC")
    List<Object[]> findCustomFieldsWithKeysByUserIdsAndInstitute(
            @Param("sourceType") String sourceType,
            @Param("userIds") List<String> userIds,
            @Param("instituteId") String instituteId);
}
