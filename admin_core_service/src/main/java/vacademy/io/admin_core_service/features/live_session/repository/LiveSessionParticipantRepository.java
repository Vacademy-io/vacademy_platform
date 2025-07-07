package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.controller.AttendanceReport;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportProjection;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;

import java.time.LocalDate;
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
            s.user_id AS studentId,
            s.full_name AS fullName,
            s.email AS email,
            s.mobile_number AS mobileNumber,
            s.gender AS gender,
            s.date_of_birth AS dateOfBirth,
            m.institute_enrollment_number AS instituteEnrollmentNumber,
            m.status AS enrollmentStatus,
            lsl.status AS attendanceStatus,
            lsl.details AS attendanceDetails,
            lsl.created_at AS attendanceTimestamp
        FROM live_session_participants lsp
        JOIN student_session_institute_group_mapping m
            ON m.package_session_id = lsp.source_id AND lsp.source_type = 'BATCH' AND m.status = 'ACTIVE'
        JOIN student s
            ON s.user_id = m.user_id
        LEFT JOIN live_session_logs lsl
            ON lsl.user_source_id = s.user_id
            AND lsl.user_source_type = 'USER'
            AND lsl.session_id = :sessionId
            AND lsl.schedule_id = :scheduleId
            AND lsl.log_type = 'ATTENDANCE_RECORDED'
        WHERE lsp.session_id = :sessionId
    """, nativeQuery = true)
        List<AttendanceReportDTO> getAttendanceReportBySessionIds(
                @Param("sessionId") String sessionId,
                @Param("scheduleId") String scheduleId
        );


    @Query(value = """
    SELECT 
        s.user_id AS studentId,
        s.full_name AS fullName,
        s.email AS email,
        s.mobile_number AS mobileNumber,
        s.gender AS gender,
        s.date_of_birth AS dateOfBirth,
        m.institute_enrollment_number AS instituteEnrollmentNumber,
        m.status AS enrollmentStatus,
        lsl.status AS attendanceStatus,
        lsl.details AS attendanceDetails,
        lsl.created_at AS attendanceTimestamp,
        lsp.session_id AS sessionId,
        ss.id AS scheduleId,
        ls.title AS title,
        ss.meeting_date AS meetingDate,
        ss.start_time AS startTime,
        ss.last_entry_time AS lastEntryTime
    FROM live_session_participants lsp
    JOIN student_session_institute_group_mapping m
        ON m.package_session_id = lsp.source_id
        AND lsp.source_type = 'BATCH' 
        AND m.status = 'ACTIVE'
    JOIN student s
        ON s.user_id = m.user_id
    JOIN session_schedules ss
        ON ss.session_id = lsp.session_id
    JOIN live_session ls
        ON ls.id = lsp.session_id 
    LEFT JOIN live_session_logs lsl
        ON lsl.user_source_id = s.user_id
        AND lsl.user_source_type = 'USER'
        AND lsl.session_id = lsp.session_id
        AND lsl.schedule_id = ss.id
        AND lsl.log_type = 'ATTENDANCE_RECORDED'
    WHERE lsp.source_id = :batchSessionId
      AND ss.meeting_date BETWEEN :startDate AND :endDate
    """, nativeQuery = true)
    List<AttendanceReportProjection> getAttendanceReportWithinDateRange(
            @Param("batchSessionId") String batchSessionId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

}
