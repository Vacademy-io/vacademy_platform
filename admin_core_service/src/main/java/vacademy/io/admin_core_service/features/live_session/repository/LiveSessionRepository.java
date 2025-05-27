package vacademy.io.admin_core_service.features.live_session.repository;

import lombok.Data;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;

import java.sql.Time;
import java.util.List;
import java.util.UUID;

@Repository
public interface LiveSessionRepository extends JpaRepository<LiveSession, String> {

    public interface LiveSessionProjection {
        UUID getSessionId();
        String getTitle();
        String getStatus();
        Data getMeetingDate();
        Time getStartTime();
        Time getLastEntryTime();
        String getCustomMeetingLink();
    }

    @Query(value = """
        SELECT s.* FROM live_session s
        JOIN session_schedules ss ON s.id = ss.session_id
        WHERE s.status = 'LIVE'
          AND ss.meeting_date = CURRENT_DATE
          AND CURRENT_TIME >= ss.start_time
          AND CURRENT_TIME <= ss.last_entry_time
    """, nativeQuery = true)
    List<LiveSession> findCurrentlyLiveSessions();
}

