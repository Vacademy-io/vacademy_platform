package vacademy.io.admin_core_service.features.live_session.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public interface ScheduleAttendanceProjection {
    String getScheduleId();
    LocalDate getMeetingDate();
    LocalTime getStartTime();
    LocalTime getLastEntryTime();
    String getSessionId();
    String getSessionTitle();
    String getSubject();
    String getSessionStatus();
    String getAccessLevel();
    String getAttendanceStatus();
    // Real per-class attended minutes reported by the provider (Zoom/BBB); null when
    // the class was not attended or the provider gave no duration.
    Integer getDurationMinutes();
}

