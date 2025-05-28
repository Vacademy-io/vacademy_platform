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
        java.sql.Date getMeetingDate();
        java.sql.Time getStartTime();
        java.sql.Time getLastEntryTime();
        String getRecurrenceType();
        String getAccessLevel();
        String getTitle();
        String getSubject();
        String getMeetingLink();
    }


    @Query(value = """
        SELECT 
            s.id AS sessionId,
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
          AND ss.meeting_date = CURRENT_DATE
          AND CURRENT_TIME >= ss.start_time
          AND CURRENT_TIME <= ss.last_entry_time
          AND s.institute_id = :instituteId
        """,
            nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findCurrentlyLiveSessions(@Param("instituteId") String instituteId);


}

