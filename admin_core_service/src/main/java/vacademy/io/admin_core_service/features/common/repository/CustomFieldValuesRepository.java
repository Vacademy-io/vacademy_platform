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
     * Distinct (customFieldId, value) pairs collected for one type_id under a source
     * type — powers the admin registration listing's per-custom-field filter options.
     * Blank values excluded; each row is [customFieldId, value].
     */
    @Query("SELECT DISTINCT cfv.customFieldId, cfv.value FROM CustomFieldValues cfv " +
            "WHERE cfv.sourceType = :sourceType AND cfv.typeId = :typeId " +
            "AND cfv.value IS NOT NULL AND TRIM(cfv.value) <> '' " +
            "ORDER BY cfv.customFieldId, cfv.value")
    List<Object[]> findDistinctFieldValuesByTypeId(
            @Param("sourceType") String sourceType,
            @Param("typeId") String typeId);

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
     * Distinct user IDs whose USER-scoped answer for a custom field is one of
     * the supplied values. Indexed lookup (idx_cfv_field_source_value) used by
     * the All Contacts custom-field filter; institute scoping happens in the
     * main paging query the resulting IDs are intersected with.
     */
    @Query(value = """
            SELECT DISTINCT cfv.source_id
            FROM custom_field_values cfv
            WHERE cfv.source_type = 'USER'
              AND cfv.custom_field_id = :customFieldId
              AND cfv.value IN (:values)
            """, nativeQuery = true)
    List<String> findUserIdsByUserSourceCustomFieldValue(
            @Param("customFieldId") String customFieldId,
            @Param("values") List<String> values);

    /**
     * Distinct user IDs whose AUDIENCE_RESPONSE-scoped answer (i.e. an answer
     * they gave on a lead/audience form) for a custom field is one of the
     * supplied values. Complements findUserIdsByUserSourceCustomFieldValue so
     * the All Contacts filter matches on EITHER answer source for the same
     * person.
     */
    @Query(value = """
            SELECT DISTINCT ar.user_id
            FROM custom_field_values cfv
            JOIN audience_response ar ON ar.id = cfv.source_id
            WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
              AND cfv.custom_field_id = :customFieldId
              AND cfv.value IN (:values)
              AND ar.user_id IS NOT NULL
            """, nativeQuery = true)
    List<String> findUserIdsByAudienceResponseCustomFieldValue(
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

    /**
     * Distinct values a custom field holds across an institute's CONTACTS —
     * the union of USER-scoped answers (enrolled learners, scoped via
     * student_session_institute_group_mapping) and AUDIENCE_RESPONSE-scoped
     * answers (leads, scoped via audience_response → audience). Powers the
     * searchable multi-select custom-field dropdowns on the All Contacts page,
     * mirroring findDistinctStudentCustomFieldValues /
     * findDistinctLeadCustomFieldValues for their surfaces.
     */
    @Query(value = """
                SELECT value FROM (
                    SELECT DISTINCT cfv.value
                    FROM custom_field_values cfv
                    JOIN student_session_institute_group_mapping ssigm ON ssigm.user_id = cfv.source_id
                    WHERE cfv.source_type = 'USER'
                      AND ssigm.institute_id = :instituteId
                      AND cfv.custom_field_id = :customFieldId
                      AND cfv.value IS NOT NULL
                      AND cfv.value <> ''
                      AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                    UNION
                    SELECT DISTINCT cfv.value
                    FROM custom_field_values cfv
                    JOIN audience_response ar ON ar.id = cfv.source_id
                    JOIN audience a ON a.id = ar.audience_id
                    WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                      AND a.institute_id = :instituteId
                      AND cfv.custom_field_id = :customFieldId
                      AND cfv.value IS NOT NULL
                      AND cfv.value <> ''
                      AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                ) combined
                ORDER BY value ASC
            """, countQuery = """
                SELECT COUNT(*) FROM (
                    SELECT DISTINCT cfv.value
                    FROM custom_field_values cfv
                    JOIN student_session_institute_group_mapping ssigm ON ssigm.user_id = cfv.source_id
                    WHERE cfv.source_type = 'USER'
                      AND ssigm.institute_id = :instituteId
                      AND cfv.custom_field_id = :customFieldId
                      AND cfv.value IS NOT NULL
                      AND cfv.value <> ''
                      AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                    UNION
                    SELECT DISTINCT cfv.value
                    FROM custom_field_values cfv
                    JOIN audience_response ar ON ar.id = cfv.source_id
                    JOIN audience a ON a.id = ar.audience_id
                    WHERE cfv.source_type = 'AUDIENCE_RESPONSE'
                      AND a.institute_id = :instituteId
                      AND cfv.custom_field_id = :customFieldId
                      AND cfv.value IS NOT NULL
                      AND cfv.value <> ''
                      AND (COALESCE(:search, '') = '' OR cfv.value ILIKE CONCAT('%', :search, '%'))
                ) combined
            """, nativeQuery = true)
    Page<String> findDistinctContactCustomFieldValues(
            @Param("instituteId") String instituteId,
            @Param("customFieldId") String customFieldId,
            @Param("search") String search,
            Pageable pageable);
}
