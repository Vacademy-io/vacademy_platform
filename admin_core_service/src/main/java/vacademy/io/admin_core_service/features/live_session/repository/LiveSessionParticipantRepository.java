package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportProjection;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleAttendanceProjection;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LiveSessionParticipantRepository extends JpaRepository<LiveSessionParticipants, String> {

    @Transactional
    void deleteAllBySessionId(String SessionId);

    @Transactional
    void deleteBySessionIdAndSourceId(String sessionId, String sourceId);

    @Transactional
    List<LiveSessionParticipants> findBySessionId(String sessionId);

        @Query(value = """
        -- Query for BATCH source type participants
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
        AND lsp.source_type = 'BATCH'
        
        UNION ALL
        
        -- Query for USER source type participants
        SELECT 
            s.user_id AS studentId,
            s.full_name AS fullName,
            s.email AS email,
            s.mobile_number AS mobileNumber,
            s.gender AS gender,
            s.date_of_birth AS dateOfBirth,
            NULL AS instituteEnrollmentNumber,
            NULL AS enrollmentStatus,
            lsl.status AS attendanceStatus,
            lsl.details AS attendanceDetails,
            lsl.created_at AS attendanceTimestamp
        FROM live_session_participants lsp
        JOIN student s
            ON s.user_id = lsp.source_id
        LEFT JOIN live_session_logs lsl
            ON lsl.user_source_id = s.user_id
            AND lsl.user_source_type = 'USER'
            AND lsl.session_id = :sessionId
            AND lsl.schedule_id = :scheduleId
            AND lsl.log_type = 'ATTENDANCE_RECORDED'
        WHERE lsp.session_id = :sessionId
        AND lsp.source_type = 'USER'
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
        m.enrolled_date AS enrolledDate,
        lsl.status AS attendanceStatus,
        lsl.details AS attendanceDetails,
        lsl.created_at AS attendanceTimestamp,
        lsp.session_id AS sessionId,
        ss.id AS scheduleId,
        ls.title AS title,
        ss.meeting_date AS meetingDate,
        ss.start_time AS startTime,
        ss.last_entry_time AS lastEntryTime,
        ss.daily_attendance AS dailyAttendance
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
      AND (m.enrolled_date IS NULL OR ss.meeting_date >= m.enrolled_date)
    """, nativeQuery = true)
    List<AttendanceReportProjection> getAttendanceReportWithinDateRange(
            @Param("batchSessionId") String batchSessionId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query(
            value = """
        SELECT DISTINCT s.user_id AS studentId
        FROM live_session_participants lsp
        JOIN student_session_institute_group_mapping m
            ON m.package_session_id = lsp.source_id
            AND lsp.source_type = 'BATCH'
            AND m.status = 'ACTIVE'
        JOIN student s ON s.user_id = m.user_id
        JOIN session_schedules ss ON ss.session_id = lsp.session_id
        WHERE ss.meeting_date BETWEEN :startDate AND :endDate
          AND (:name IS NULL OR LOWER(s.full_name) LIKE LOWER(CONCAT('%', :name, '%')))
          AND (:batchIdsSize = 0 OR lsp.source_id IN (:batchIds))
          AND (:liveSessionIdsSize = 0 OR lsp.session_id IN (:liveSessionIds))
          AND (m.enrolled_date IS NULL OR m.enrolled_date <= :endDate)
        """,
            countQuery = """
        SELECT COUNT(DISTINCT s.user_id)
        FROM live_session_participants lsp
        JOIN student_session_institute_group_mapping m
            ON m.package_session_id = lsp.source_id
            AND lsp.source_type = 'BATCH'
            AND m.status = 'ACTIVE'
        JOIN student s ON s.user_id = m.user_id
        JOIN session_schedules ss ON ss.session_id = lsp.session_id
        WHERE ss.meeting_date BETWEEN :startDate AND :endDate
          AND (:name IS NULL OR LOWER(s.full_name) LIKE LOWER(CONCAT('%', :name, '%')))
          AND (:batchIdsSize = 0 OR lsp.source_id IN (:batchIds))
          AND (:liveSessionIdsSize = 0 OR lsp.session_id IN (:liveSessionIds))
          AND (m.enrolled_date IS NULL OR m.enrolled_date <= :endDate)
        """,
            nativeQuery = true
    )
    Page<String> findDistinctStudentIdsWithFilters(
            @Param("name") String name,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("batchIds") List<String> batchIds,
            @Param("batchIdsSize") int batchIdsSize,
            @Param("liveSessionIds") List<String> liveSessionIds,
            @Param("liveSessionIdsSize") int liveSessionIdsSize,
            Pageable pageable
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
        m.enrolled_date AS enrolledDate,
        lsl.status AS attendanceStatus,
        lsl.details AS attendanceDetails,
        lsl.created_at AS attendanceTimestamp,
        lsp.session_id AS sessionId,
        ss.id AS scheduleId,
        ls.title AS title,
        ss.meeting_date AS meetingDate,
        ss.start_time AS startTime,
        ss.last_entry_time AS lastEntryTime,
        ss.daily_attendance AS dailyAttendance
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
    WHERE s.user_id IN (:studentIds)
    AND ss.meeting_date BETWEEN :startDate AND :endDate
    AND (m.enrolled_date IS NULL OR ss.meeting_date >= m.enrolled_date)
    ORDER BY LOWER(s.full_name), ss.meeting_date
""",nativeQuery = true)
    List<AttendanceReportProjection> getAttendanceReportForStudentIds(
            @Param("studentIds") List<String> studentIds,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query(value = """
    SELECT DISTINCT ON (ss.id, ls.id)
        ss.id AS scheduleId,
        ss.meeting_date AS meetingDate,
        ss.start_time AS startTime,
        ss.last_entry_time AS lastEntryTime,
        ls.id AS sessionId,
        ls.title AS sessionTitle,
        ls.subject AS subject,
        ls.status AS sessionStatus,
        ls.access_level AS accessLevel,
        COALESCE(lsl.status, 'ABSENT') AS attendanceStatus
    FROM live_session_participants lsp
    JOIN session_schedules ss ON ss.session_id = lsp.session_id
    JOIN live_session ls ON ls.id = lsp.session_id AND ls.status = 'LIVE'
    LEFT JOIN LATERAL (
        SELECT status, details, created_at
        FROM live_session_logs
        WHERE session_id = lsp.session_id
          AND schedule_id = ss.id
          AND user_source_type = 'USER'
          AND user_source_id = :userId
          AND log_type = 'ATTENDANCE_RECORDED'
        ORDER BY created_at DESC
        LIMIT 1
    ) lsl ON TRUE
    WHERE
        lsp.source_type = 'BATCH'
        AND lsp.source_id = :batchId
        AND ss.meeting_date BETWEEN :startDate AND :endDate
    ORDER BY ss.id, ls.id
    """, nativeQuery = true)
    List<ScheduleAttendanceProjection> findAttendanceForUserInBatch(
            @Param("batchId") String batchId,
            @Param("userId") String userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @Query(value = """
    SELECT 
        CASE 
            WHEN total_days = 0 THEN 0
            ELSE ROUND((attended_days * 100.0) / total_days, 2)
        END AS attendance_percentage
    FROM (
        -- Total scheduled days in the batch
        SELECT COUNT(DISTINCT ss.meeting_date) AS total_days
        FROM session_schedules ss
        JOIN live_session_participants lsp 
            ON lsp.session_id = ss.session_id
        WHERE lsp.source_type = 'BATCH'
          AND lsp.source_id = :batchId
          AND ss.meeting_date BETWEEN :startDate AND :endDate
    ) total
    CROSS JOIN (
        SELECT COUNT(DISTINCT ss.meeting_date) AS attended_days
        FROM session_schedules ss
        JOIN live_session_participants lsp 
            ON lsp.session_id = ss.session_id
        JOIN live_session_logs lsl 
            ON lsl.session_id = ss.session_id
           AND lsl.schedule_id = ss.id
           AND lsl.user_source_type = 'USER'
           AND lsl.user_source_id = :userId
           AND lsl.log_type = 'ATTENDANCE_RECORDED'
        WHERE lsp.source_type = 'BATCH'
          AND lsp.source_id = :batchId
          AND ss.meeting_date BETWEEN :startDate AND :endDate
    ) attended
    """, nativeQuery = true)
    Double getAttendancePercentage(
            @Param("batchId") String batchId,
            @Param("userId") String userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );


}
