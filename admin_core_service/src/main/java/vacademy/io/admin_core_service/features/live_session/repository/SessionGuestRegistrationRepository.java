package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.live_session.dto.GuestAttendanceDTO;
import vacademy.io.admin_core_service.features.live_session.dto.GuestSessionCustomFieldDTO;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;

import java.util.List;
import java.util.Optional;

public interface SessionGuestRegistrationRepository extends JpaRepository<SessionGuestRegistration, String> {

    @Transactional
    boolean existsBySessionIdAndEmail(String sessionId, String email);

    Optional<SessionGuestRegistration> findBySessionIdAndEmail(String sessionId, String email);

    @Query(value = """
            SELECT
                sgr.id AS guestId,
                sgr.email AS guestEmail,
                sgr.registered_at AS registeredAt,
                lsl.status AS attendanceStatus,
                lsl.details AS attendanceDetails,
                lsl.created_at AS attendanceTimestamp,
                (
                    SELECT cfv.value
                    FROM custom_field_values cfv
                    JOIN custom_fields cf ON cf.id = cfv.custom_field_id
                    WHERE cfv.source_id = sgr.id
                    AND (cf.field_key ILIKE '%name%' OR cf.field_name ILIKE '%name%')
                    ORDER BY cf.form_order ASC
                    LIMIT 1
                ) AS guestName,
                (
                    SELECT cfv.value
                    FROM custom_field_values cfv
                    JOIN custom_fields cf ON cf.id = cfv.custom_field_id
                    WHERE cfv.source_id = sgr.id
                    AND (cf.field_key ILIKE '%mobile%' OR cf.field_key ILIKE '%phone%' 
                         OR cf.field_name ILIKE '%mobile%' OR cf.field_name ILIKE '%phone%')
                    ORDER BY cf.form_order ASC
                    LIMIT 1
                ) AS mobileNumber,
                'EXTERNAL_USER' AS sourceType
            FROM session_guest_registrations sgr
            LEFT JOIN live_session_logs lsl
                ON lsl.session_id = sgr.session_id
                AND lsl.schedule_id = :scheduleId
                AND lsl.user_source_type = 'EXTERNAL_USER'
                AND lsl.user_source_id = sgr.id
                AND lsl.log_type = 'ATTENDANCE_RECORDED'
            WHERE sgr.session_id = :sessionId
            """, nativeQuery = true)
    List<GuestAttendanceDTO> findGuestAttendanceBySessionAndSchedule(
            @Param("sessionId") String sessionId,
            @Param("scheduleId") String scheduleId);

    @Query(value = """
            SELECT
                sgr.id AS guestId,
                ls.id AS liveSessionId,
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
                cf.is_hidden AS isHidden,
                cf.created_at AS createdAt,
                cf.updated_at AS updatedAt,
                cfv.value AS customFieldValue
            FROM session_guest_registrations sgr
            JOIN live_session ls
                ON ls.id = sgr.session_id
            JOIN institute_custom_fields icf
                ON icf.type = 'SESSION'
                AND icf.type_id = ls.id
            JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                ON cfv.custom_field_id = cf.id
            WHERE sgr.session_id = :sessionId
            """, nativeQuery = true)
    List<GuestSessionCustomFieldDTO> findGuestCustomFieldsBySessionId(@Param("sessionId") String sessionId);

}
