package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

public interface LiveSessionLogsRepository extends JpaRepository<LiveSessionLogs, String>, LiveSessionLogsRepositoryCustom {

    @Query("SELECT l FROM LiveSessionLogs l WHERE l.scheduleId = :scheduleId AND l.logType = 'ATTENDANCE_RECORDED'")
    List<LiveSessionLogs> findAllAttendanceByScheduleId(@Param("scheduleId") String scheduleId);

    @Query("SELECT l FROM LiveSessionLogs l WHERE l.scheduleId = :scheduleId AND l.userSourceId = :userSourceId AND l.logType = 'ATTENDANCE_RECORDED' ORDER BY l.createdAt ASC")
    List<LiveSessionLogs> findAllAttendanceRecords(@Param("scheduleId") String scheduleId,
            @Param("userSourceId") String userSourceId);

    default Optional<LiveSessionLogs> findExistingAttendanceRecord(String scheduleId, String userSourceId) {
        List<LiveSessionLogs> records = findAllAttendanceRecords(scheduleId, userSourceId);
        return records.isEmpty() ? Optional.empty() : Optional.of(records.get(0));
    }

    /*
     * The single-round-trip attendance upsert lives in
     * LiveSessionLogsRepositoryCustomImpl.upsertAttendanceReturningPreviousStatus.
     * It has to report the pre-existing status so callers can skip re-notifying
     * on a repeat mark, and @Modifying cannot return a value. Conflict target is
     * still the partial unique index uq_lsl_attendance_schedule_user (V415).
     */

    /**
     * Upsert for the BBB meeting-join path (also a class-start stampede).
     * Carries provider join metadata; on conflict it refreshes join
     * time/meeting id and forces PRESENT but leaves details untouched,
     * matching the previous update branch of markBbbAttendance.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO live_session_logs
                (id, session_id, schedule_id, user_source_type, user_source_id,
                 log_type, status, status_type, details, provider_join_time,
                 provider_meeting_id, updated_at)
            VALUES (:id, :sessionId, :scheduleId, 'USER', :userSourceId,
                    'ATTENDANCE_RECORDED', 'PRESENT', 'ONLINE', :details,
                    :providerJoinTime, :providerMeetingId, now())
            ON CONFLICT (schedule_id, user_source_id) WHERE log_type = 'ATTENDANCE_RECORDED'
            DO UPDATE SET status              = 'PRESENT',
                          status_type         = 'ONLINE',
                          provider_join_time  = EXCLUDED.provider_join_time,
                          provider_meeting_id = EXCLUDED.provider_meeting_id,
                          updated_at          = now()
            """, nativeQuery = true)
    void upsertBbbJoinAttendance(
            @Param("id") String id,
            @Param("sessionId") String sessionId,
            @Param("scheduleId") String scheduleId,
            @Param("userSourceId") String userSourceId,
            @Param("details") String details,
            @Param("providerJoinTime") String providerJoinTime,
            @Param("providerMeetingId") String providerMeetingId);

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

    /**
     * Count attendance records for a specific user across all sessions.
     * Used by UserLeadProfileService to compute demo_attendance_count.
     */
    long countByUserSourceIdAndLogType(String userSourceId, String logType);

    @Query("""
        SELECT l FROM LiveSessionLogs l
        WHERE l.logType = :logType
          AND l.userSourceType = :userSourceType
          AND l.createdAt BETWEEN :startTime AND :endTime
    """)
    List<LiveSessionLogs> findByLogTypeAndUserSourceTypeAndCreatedAtBetween(
        @Param("logType") String logType,
        @Param("userSourceType") String userSourceType,
        @Param("startTime") Timestamp startTime,
        @Param("endTime") Timestamp endTime
    );

    @Query("""
            SELECT l FROM LiveSessionLogs l
            WHERE l.scheduleId = :scheduleId
              AND l.userSourceId = :userId
              AND l.logType = 'FEEDBACK_SUBMITTED'
            ORDER BY l.createdAt ASC
        """)
    List<LiveSessionLogs> findFeedbackByScheduleAndUser(
            @Param("scheduleId") String scheduleId,
            @Param("userId") String userId);

    default boolean hasFeedbackBeenSubmitted(String scheduleId, String userId) {
        return !findFeedbackByScheduleAndUser(scheduleId, userId).isEmpty();
    }

    /**
     * Batched attendance + engagement lookup for the learner "Past Sessions"
     * endpoint — one query for the whole page of schedule_ids instead of one
     * query per card (avoids N+1). Feeds both attendance_status and the
     * activity block (engagement_data + provider_total_duration_minutes) from
     * the same rows.
     */
    @Query("""
        SELECT l FROM LiveSessionLogs l
        WHERE l.scheduleId IN :scheduleIds
          AND l.userSourceId = :userId
          AND l.logType = 'ATTENDANCE_RECORDED'
    """)
    List<LiveSessionLogs> findAttendanceLogsForScheduleIdsAndUser(
            @Param("scheduleIds") List<String> scheduleIds,
            @Param("userId") String userId);
}