package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.controller.AttendanceReport;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;

import java.util.List;
import java.util.UUID;

@Repository
public interface LiveSessionParticipantRepository extends JpaRepository<LiveSessionParticipants, String> {

    @Transactional
    void deleteAllBySessionId(String SessionId);

    @Transactional
    void deleteBySessionIdAndSourceId(String sessionId, String sourceId);

    @Transactional
    List<LiveSessionParticipants> findBySessionId(String sessionId);

    @Query(value = """
        SELECT
            ssgm.user_id AS userId,
            ssgm.status AS enrollmentStatus,
            lsl.status AS attendanceStatus,
            lsl.details AS attendanceDetails,
            lsl.created_at AS attendanceLoggedAt
        FROM live_session_participants lsp
        JOIN student_session_institute_group_mapping ssgm
            ON ssgm.package_session_id = lsp.source_id
        LEFT JOIN live_session_logs lsl
            ON lsl.session_id = lsp.session_id
            AND lsl.user_source_type = 'USER'
            AND lsl.user_source_id = ssgm.user_id
            AND lsl.log_type = 'ATTENDANCE_RECORDED'
        WHERE lsp.session_id IN (:sessionIds)
          AND lsp.source_type = 'BATCH'
        """, nativeQuery = true)
    List<AttendanceReportDTO> getAttendanceReportBySessionIds(@Param("sessionIds") List<String> sessionIds);
}
