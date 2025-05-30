package vacademy.io.admin_core_service.features.live_session.repository;

import lombok.Data;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;

import java.sql.Time;
import java.util.List;
import java.util.UUID;

@Repository
public interface LiveSessionRepository extends JpaRepository<LiveSession, String> {

    public interface LiveSessionListProjection {
        String getSessionId();
        String getScheduleId();
        java.sql.Date getMeetingDate();
        java.sql.Time getStartTime();
        java.sql.Time getLastEntryTime();
        String getRecurrenceType();
        String getAccessLevel();
        String getTitle();
        String getSubject();
        String getMeetingLink();
    }

    public interface ScheduledSessionProjection {
        String getScheduleId();
        String getSessionId();
        String getTitle();
        String getSubject();
        java.sql.Date getMeetingDate();
        java.sql.Time getStartTime();
        java.sql.Time getLastEntryTime();
        String getCustomMeetingLink();
        String getCustomWaitingRoomMediaId();
        String getDefaultMeetLink();
        String getWaitingRoomLink();
        String getStatus();
    }



    @Query(value = """
        SELECT
            s.id AS sessionId,
            ss.meeting_date AS meetingDate,
            ss.id AS scheduleId,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink
        FROM live_session s
        JOIN session_schedules ss ON s.id = ss.session_id
        WHERE s.status = 'LIVE'
          AND ss.meeting_date = CURRENT_DATE
          AND CURRENT_TIME >= ss.start_time
          AND CURRENT_TIME <= ss.last_entry_time
          AND s.institute_id = :instituteId
        """,
            nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findCurrentlyLiveSessions(@Param("instituteId") String instituteId);

@Query(value = """
        SELECT
            s.id AS sessionId,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink
        FROM live_session s
        JOIN session_schedules ss ON s.id = ss.session_id
        WHERE s.status = 'LIVE'
          AND ss.meeting_date > CURRENT_DATE
          AND s.institute_id = :instituteId
          ORDER BY ss.meeting_date ASC, ss.start_time ASC
        """,
            nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessions(@Param("instituteId") String instituteId);

@Query(value = """
        SELECT
            s.id AS sessionId,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink
        FROM live_session s
        JOIN session_schedules ss ON s.id = ss.session_id
        WHERE s.status = 'LIVE'
          AND ss.meeting_date < CURRENT_DATE
          AND s.institute_id = :instituteId
          ORDER BY ss.meeting_date ASC, ss.start_time ASC
        """,
            nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findPreviousSessions(@Param("instituteId") String instituteId);


        @Query(value = """
        SELECT
            s.id AS sessionId,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        JOIN live_session_participants lsp ON lsp.session_id = s.id
        WHERE lsp.source_type = 'BATCH'
          AND lsp.source_id = :batchId
          AND ss.meeting_date >= CURRENT_DATE
        ORDER BY ss.meeting_date, ss.start_time
    """, nativeQuery = true)
        List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessionsForBatch(@Param("batchId") String batchId);


}

