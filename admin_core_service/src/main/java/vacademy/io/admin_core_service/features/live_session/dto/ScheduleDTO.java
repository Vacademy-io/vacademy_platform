package vacademy.io.admin_core_service.features.live_session.dto;


import java.time.*;

public interface ScheduleDTO {
    String getScheduleId();
    String getSessionId();
    LocalDate getMeetingDate();
    LocalTime getScheduleStartTime();
    LocalTime getScheduleLastEntryTime();
    String getSessionTitle();
    String getSubject();
    LocalDateTime getSessionStartTime();
    String getSessionStatus();
}
