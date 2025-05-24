package vacademy.io.admin_core_service.features.live_session.repository;

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
    }

    @Query(value = """
        SELECT
          cf.id AS customFieldId,
          cf.field_key AS fieldKey,
          cf.field_name AS fieldName,
          cf.field_type AS fieldType,
          cf.default_value AS defaultValue,
          cf.config AS config,
          cf.form_order AS formOrder,
          cf.is_mandatory AS isMandatory,
          cf.is_filter AS isFilter,
          cf.is_sortable AS isSortable,
          icf.institute_id AS instituteId,
          s.id AS sessionId,
          s.title AS sessionTitle,
          s.start_time AS startTime,
          s.last_entry_time AS lastEntryTime,
          s.access_level AS accessLevel
        FROM institute_custom_fields icf
        JOIN custom_fields cf ON icf.custom_field_id = cf.id
        JOIN live_session s ON icf.type_id = s.id
        WHERE icf.type = 'SESSION' AND s.id = :sessionId
        """, nativeQuery = true)
    List<FlatFieldProjection> getSessionCustomFieldsBySessionId(@Param("sessionId") String sessionId);

}
