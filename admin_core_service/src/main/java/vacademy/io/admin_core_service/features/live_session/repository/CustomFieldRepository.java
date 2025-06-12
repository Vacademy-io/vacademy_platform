package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.entity.CustomFields;

import java.time.LocalDateTime;
import java.util.List;


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

      s.institute_id      AS instituteId,
      s.id                AS sessionId,
      s.title             AS sessionTitle,
      s.start_time        AS startTime,
      s.last_entry_time   AS lastEntryTime,
      s.access_level      AS accessLevel,
      s.subject           AS subject,
      s.cover_file_id     AS coverFileId
    FROM live_session s
    LEFT JOIN institute_custom_fields icf
           ON icf.type     = 'SESSION'
          AND icf.type_id  = s.id
    LEFT JOIN custom_fields cf
           ON cf.id = icf.custom_field_id
    WHERE s.id     = :sessionId
      AND s.status = 'LIVE'
    """, nativeQuery = true)
    List<FlatFieldProjection> getSessionCustomFieldsBySessionId(@Param("sessionId") String sessionId);


}
