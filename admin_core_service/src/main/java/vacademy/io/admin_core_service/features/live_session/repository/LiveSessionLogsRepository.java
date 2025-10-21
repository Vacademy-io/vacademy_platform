package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;

import java.util.Optional;


public interface LiveSessionLogsRepository extends JpaRepository<LiveSessionLogs, String> {

    @Query("SELECT l FROM LiveSessionLogs l WHERE l.scheduleId = :scheduleId AND l.userSourceId = :userSourceId AND l.logType = 'ATTENDANCE_RECORDED'")
    Optional<LiveSessionLogs> findExistingAttendanceRecord(@Param("scheduleId") String scheduleId, @Param("userSourceId") String userSourceId);

}