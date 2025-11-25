package vacademy.io.admin_core_service.features.common.repository;

import org.springframework.data.jpa.repository.JpaRepository;
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
   */
  @Query("""
      SELECT cf FROM CustomFields cf 
      WHERE cf.id IN (
          SELECT icf.customFieldId FROM InstituteCustomField icf 
          WHERE icf.instituteId = :instituteId 
          AND icf.status = :status
      )
      AND cf.fieldType = :fieldType 
      AND cf.status = :status
      ORDER BY cf.formOrder ASC
      """)
  List<CustomFields> findDropdownCustomFieldsByInstituteId(
      @Param("instituteId") String instituteId, 
      @Param("fieldType") String fieldType,
      @Param("status") String status
  );


}
