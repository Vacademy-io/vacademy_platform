package vacademy.io.admin_core_service.features.common.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomFieldRepository extends JpaRepository<CustomFields, String> {

  interface FlatFieldProjection {
    String getCustomFieldId();

    String getFieldKey();

    String getFieldName();

    String getFieldType();

    String getDefaultValue();

    String getConfig();

    String getSubject();

    int getFormOrder();

    boolean getIsMandatory();

    boolean getIsFilter();

    boolean getIsSortable();

    boolean getIsHidden();

    String getInstituteId();

    String getSessionId();

    String getSessionTitle();

    LocalDateTime getStartTime();

    LocalDateTime getLastEntryTime();

    String getAccessLevel();

    String getCoverFileId();
  }

  @Query(value = """
      SELECT
        cf.id               AS customFieldId,
        cf.field_key        AS fieldKey,
        cf.field_name       AS fieldName,
        cf.field_type       AS fieldType,
        cf.default_value    AS defaultValue,
        cf.config           AS config,
        cf.form_order       AS formOrder,
        cf.is_mandatory     AS isMandatory,
        cf.is_filter        AS isFilter,
        cf.is_sortable      AS isSortable,
        cf.is_hidden        AS isHidden,

        s.institute_id      AS instituteId,
        s.id                AS sessionId,
        s.title             AS sessionTitle,
        s.start_time        AS startTime,
        s.last_entry_time   AS lastEntryTime,
        s.access_level      AS accessLevel,
        s.subject           AS subject,
        s.cover_file_id     AS coverFileId
      FROM live_session s
      INNER JOIN institute_custom_fields icf
             ON icf.type     = 'SESSION'
            AND icf.type_id  = s.id
      LEFT JOIN custom_fields cf
             ON cf.id = icf.custom_field_id
      WHERE s.id     = :sessionId
        AND s.status = 'LIVE'
      """, nativeQuery = true)
  List<FlatFieldProjection> getSessionCustomFieldsBySessionId(@Param("sessionId") String sessionId);

  /**
   * Find custom field by field key
   */
  Optional<CustomFields> findByFieldKey(String fieldKey);

  /**
   * Find custom field by field key and institute ID (through institute custom
   * field mapping)
   */

  // In CustomFieldRepository
  Optional<CustomFields> findTopByFieldKeyAndStatusOrderByCreatedAtDesc(String fieldKey, String status);

  /**
   * Find all DROPDOWN custom fields for an institute that are ACTIVE
   * Uses DISTINCT ON with LOWER(field_name) to return only one record per unique
   * field name (case-insensitive)
   * Keeps the most recent one based on created_at
   */
  @Query(value = """
      SELECT DISTINCT ON (LOWER(cf.field_name)) cf.*
      FROM custom_fields cf
      WHERE cf.id IN (
          SELECT icf.custom_field_id FROM institute_custom_fields icf
          WHERE icf.institute_id = :instituteId
          AND icf.status = :status
      )
      AND UPPER(cf.field_type) = UPPER(:fieldType)
      AND cf.status = :status
      ORDER BY LOWER(cf.field_name), cf.created_at DESC, cf.form_order ASC
      """, nativeQuery = true)
  List<CustomFields> findDropdownCustomFieldsByInstituteId(
      @Param("instituteId") String instituteId,
      @Param("fieldType") String fieldType,
      @Param("status") String status);

  /**
   * Find custom field by field_key and institute_id
   * Used for update operations to ensure we get the correct custom field for a
   * specific institute
   */
  @Query(value = """
      SELECT cf.*
      FROM custom_fields cf
      JOIN institute_custom_fields icf ON icf.custom_field_id = cf.id
      WHERE cf.field_key = :fieldKey
        AND icf.institute_id = :instituteId
        AND icf.status = 'ACTIVE'
        AND cf.status = 'ACTIVE'
      LIMIT 1
      """, nativeQuery = true)
  Optional<CustomFields> findByFieldKeyAndInstituteId(
      @Param("fieldKey") String fieldKey,
      @Param("instituteId") String instituteId);

  /**
   * Find custom field by field_key with pessimistic lock to prevent race conditions
   * Used during custom field creation to ensure no duplicates
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT cf FROM CustomFields cf WHERE cf.fieldKey = :fieldKey AND cf.status = :status ORDER BY cf.createdAt DESC")
  Optional<CustomFields> findByFieldKeyWithLock(
      @Param("fieldKey") String fieldKey,
      @Param("status") String status);

}
