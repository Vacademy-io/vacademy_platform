package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;

import java.util.List;
import java.util.Optional;

public interface LiveSessionLogsRepository extends JpaRepository<LiveSessionLogs, String> {

    @Query("SELECT l FROM LiveSessionLogs l WHERE l.scheduleId = :scheduleId AND l.logType = 'ATTENDANCE_RECORDED'")
    List<LiveSessionLogs> findAllAttendanceByScheduleId(@Param("scheduleId") String scheduleId);

    @Query("SELECT l FROM LiveSessionLogs l WHERE l.scheduleId = :scheduleId AND l.userSourceId = :userSourceId AND l.logType = 'ATTENDANCE_RECORDED' ORDER BY l.createdAt ASC")
    List<LiveSessionLogs> findAllAttendanceRecords(@Param("scheduleId") String scheduleId,
            @Param("userSourceId") String userSourceId);

    default Optional<LiveSessionLogs> findExistingAttendanceRecord(String scheduleId, String userSourceId) {
        List<LiveSessionLogs> records = findAllAttendanceRecords(scheduleId, userSourceId);
        return records.isEmpty() ? Optional.empty() : Optional.of(records.get(0));
    }

    /**
     * Used by the provider sync scheduler to upsert provider-sourced attendance.
     * Looks up by schedule + attendee email (stored in userSourceId for
     * PROVIDER_EMAIL records).
     */
    @Query("""
                SELECT l FROM LiveSessionLogs l
                WHERE l.scheduleId = :scheduleId
                  AND l.userSourceId = :email
                  AND l.userSourceType = 'PROVIDER_EMAIL'
                  AND l.logType = 'ATTENDANCE_RECORDED'
                ORDER BY l.createdAt ASC
            """)
    List<LiveSessionLogs> findAllProviderAttendanceRecords(
            @Param("scheduleId") String scheduleId,
            @Param("email") String email);

    default Optional<LiveSessionLogs> findExistingProviderAttendanceRecord(String scheduleId, String email) {
        List<LiveSessionLogs> records = findAllProviderAttendanceRecords(scheduleId, email);
        return records.isEmpty() ? Optional.empty() : Optional.of(records.get(0));
    }

}