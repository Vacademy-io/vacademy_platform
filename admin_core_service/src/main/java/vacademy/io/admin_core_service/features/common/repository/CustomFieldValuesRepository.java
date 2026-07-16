package vacademy.io.admin_core_service.features.common.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
     * Distinct audience_response IDs whose value for a given custom field is one
     * of the supplied values. Single indexed lookup (idx_cfv_field_source_value)
     * used to pre-resolve the leads custom-field filter into a concrete id set,
     * instead of a per-row correlated subquery in the (institute-wide) leads
     * query — which scanned custom_field_values for every candidate lead and timed out.
     */
    @Query(value = """
            SELECT DISTINCT cfv.source_id
            FROM custom_field_values cfv
            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
              AND cfv.custom_field_id = :customFieldId
              AND cfv.value IN (:values)
            """, nativeQuery = true)
    List<String> findAudienceResponseIdsByCustomFieldValue(
            @Param("customFieldId") String customFieldId,
            @Param("values") List<String> values);

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

    /**
     * Distinct values a custom field holds across an institute's learners —
     * powers the searchable, paginated multi-select dropdown for free-text
     * (non-DROPDOWN) custom-field filters on Manage Students, e.g. VetEducation's
     * "Practice Type". Scoped to the institute via
     * custom_field_values(source_type='USER') → student_session_institute_group_mapping
     * on user_id, mirroring how InstituteStudentRepositoryImpl's per-row custom-field
     * EXISTS filter resolves USER-scoped values. `:search` is a case-insensitive
     * substring (blank = all values).
     */
    @Query(value = """
                SELECT DISTINCT cfv.value
                FROM custom_field_values cfv
                JOIN student_session_institute_group_mapping ssigm ON ssigm.user_id = cfv.source_id
                WHERE cfv.source_type = 'USER'
                  AND ssigm.institute_id = :instituteId
                  AND cfv.custom_field_id = :customFieldId
                  AND cfv.value IS NOT NULL
                  AND cfv.value <> ''
                  AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                ORDER BY cfv.value ASC
            """, countQuery = """
                SELECT COUNT(DISTINCT cfv.value)
                FROM custom_field_values cfv
                JOIN student_session_institute_group_mapping ssigm ON ssigm.user_id = cfv.source_id
                WHERE cfv.source_type = 'USER'
                  AND ssigm.institute_id = :instituteId
                  AND cfv.custom_field_id = :customFieldId
                  AND cfv.value IS NOT NULL
                  AND cfv.value <> ''
                  AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
            """, nativeQuery = true)
    Page<String> findDistinctStudentCustomFieldValues(
            @Param("instituteId") String instituteId,
            @Param("customFieldId") String customFieldId,
            @Param("search") String search,
            Pageable pageable);
}
