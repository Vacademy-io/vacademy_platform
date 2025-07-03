package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.live_session.dto.GuestAttendanceDTO;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;

import java.util.List;

public interface SessionGuestRegistrationRepository extends JpaRepository<SessionGuestRegistration, String> {

    @Transactional
    boolean existsBySessionIdAndEmail(String sessionId, String email);



    @Query(value = """
        SELECT
            sgr.email AS guestEmail,
            sgr.registered_at AS registeredAt,
            lsl.status AS attendanceStatus,
            lsl.details AS attendanceDetails,
            lsl.created_at AS attendanceTimestamp
        FROM session_guest_registrations sgr
        LEFT JOIN live_session_logs lsl
            ON lsl.session_id = sgr.session_id
            AND lsl.schedule_id = :scheduleId
            AND lsl.user_source_type = 'GUEST'
            AND lsl.user_source_id = sgr.email
            AND lsl.log_type = 'ATTENDANCE_RECORDED'
        WHERE sgr.session_id = :sessionId
    """, nativeQuery = true)
    List<GuestAttendanceDTO> findGuestAttendanceBySessionAndSchedule(
            @Param("sessionId") String sessionId,
            @Param("scheduleId") String scheduleId
    );
}

