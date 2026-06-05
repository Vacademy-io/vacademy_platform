package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleDTO;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;

import java.sql.Time;
import java.sql.Timestamp;
import java.sql.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionScheduleRepository extends JpaRepository<SessionSchedule, String> {
    List<SessionSchedule> findBySessionId(String sessionId);

    List<SessionSchedule> findByProviderMeetingId(String providerMeetingId);

    /**
     * Pessimistic-write fetch (SELECT ... FOR UPDATE). Used by the BBB
     * meeting/join flow to serialize concurrent first-join requests for the same
     * scheduleId so that exactly one BBB meeting is ever created per session.
     * The 10s lock timeout is well above p99 BBB /create latency and prevents
     * indefinite waits if the holder is stuck on a slow upstream call.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "10000")})
    @Query("SELECT s FROM SessionSchedule s WHERE s.id = :id")
    Optional<SessionSchedule> findByIdForUpdate(@Param("id") String id);

    @Transactional
    void deleteBySessionId(String sessionId);

    public interface ScheduleDetailsProjection {
        String getSessionId();

        String getScheduleId();

        String getInstituteId();

        Timestamp getSessionStartTime();

        Timestamp getLastEntryTime();

        String getAccessLevel();

        String getMeetingType();

        String getLinkType();

        String getSessionStreamingServiceType();

        String getDefaultMeetLink();

        String getDefaultClassLink();

        String getDefaultClassName();

        String getDefaultClassLinkType();

        String getLearnerButtonConfig();

        String getWaitingRoomLink();

        Integer getWaitingRoomTime();

        String getRegistrationFormLinkForPublicSessions();

        String getCreatedByUserId();

        String getTitle();

        String getDescriptionHtml();

        String getNotificationEmailMessage();

        String getAttendanceEmailMessage();

        String getCoverFileId();

        String getSubject();

        String getThumbnailFileId(); // already existed for live_session

        String getBackgroundScoreFileId();

        String getStatus();

        String getAllowRewind();

        String getRecurrenceType();

        String getRecurrenceKey();

        Date getMeetingDate();

        Time getScheduleStartTime();

        Time getScheduleLastEntryTime();

        String getCustomMeetingLink();

        String getCustomWaitingRoomMediaId();

        String getScheduleThumbnailFileId(); // NEW — from session_schedules

        Boolean getDailyAttendance(); // NEW — from session_schedules

        Boolean getAllowPlayPause();

        String getTimezone();

        String getProviderHostUrl();

        String getProviderMeetingId();

    }

    @Query(value = """
                SELECT
                    ss.id AS scheduleId,
                    ss.session_id AS sessionId,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS scheduleStartTime,
                    ss.last_entry_time AS scheduleLastEntryTime,
                    ss.custom_meeting_link AS customMeetingLink,
                    ss.recurrence_type AS recurrenceType,
                    s.title AS sessionTitle,
                    s.subject AS subject,
                    s.start_time AS sessionStartTime,
                    s.status AS sessionStatus,
                    s.institute_id AS instituteId,
                    s.last_entry_time AS lastEntryTime,
                    s.access_level AS accessLevel,
                    s.meeting_type AS meetingType,
                    s.link_type AS linkType,
                    s.session_streaming_service_type AS sessionStreamingServiceType,
                    s.default_meet_link AS defaultMeetLink,
                    ss.default_class_link AS defaultClassLink,
                    ss.default_class_name AS defaultClassName,
                    ss.default_class_link_type AS defaultClassLinkType,
                    s.learner_button_config AS learnerButtonConfig,
                    s.waiting_room_link AS waitingRoomLink,
                    s.waiting_room_time AS waitingRoomTime,
                    s.waiting_room_type AS waitingRoomType,
                    s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
                    s.created_by_user_id AS createdByUserId,
                    s.description_html AS descriptionHtml,
                    s.notification_email_message AS notificationEmailMessage,
                    s.attendance_email_message AS attendanceEmailMessage,
                    s.cover_file_id AS coverFileId,
                    s.thumbnail_file_id AS thumbnailFileId,
                    s.background_score_file_id AS backgroundScoreFileId,
                    ss.thumbnail_file_id AS scheduleThumbnailFileId,  -- NEW
                    ss.daily_attendance AS dailyAttendance,           -- NEW
                    s.allow_rewind AS allowRewind,
                    s.allow_play_pause AS allowPlayPause,
                    COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
                    ss.provider_recordings_json AS providerRecordingsJson,
                    ss.provider_host_url AS providerHostUrl
                FROM live_session s
                LEFT JOIN session_schedules ss ON s.id = ss.session_id
                WHERE s.id = :sessionId
                  AND (ss.id IS NULL OR ss.status != 'DELETED')
                ORDER BY ss.meeting_date ASC
            """, nativeQuery = true)
    List<ScheduleDTO> findSchedulesBySessionId(@Param("sessionId") String sessionId);

    @Query(value = """
                SELECT
                    s.id AS sessionId,
                    ss.id AS scheduleId,
                    s.institute_id AS instituteId,
                    s.start_time AS sessionStartTime,
                    s.last_entry_time AS lastEntryTime,
                    s.access_level AS accessLevel,
                    s.meeting_type AS meetingType,
                    s.link_type AS linkType,
                    s.session_streaming_service_type AS sessionStreamingServiceType,
                    s.default_meet_link AS defaultMeetLink,
                    ss.default_class_link AS defaultClassLink,
                    ss.default_class_name AS defaultClassName,
                    ss.default_class_link_type AS defaultClassLinkType,
                    s.learner_button_config AS learnerButtonConfig,
                    s.waiting_room_link AS waitingRoomLink,
                    s.waiting_room_time AS waitingRoomTime,
                    s.waiting_room_type AS waitingRoomType,
                    s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
                    s.created_by_user_id AS createdByUserId,
                    s.title AS title,
                    s.description_html AS descriptionHtml,
                    s.notification_email_message AS notificationEmailMessage,
                    s.attendance_email_message AS attendanceEmailMessage,
                    s.cover_file_id AS coverFileId,
                    s.subject AS subject,
                    s.thumbnail_file_id AS thumbnailFileId,
                    s.background_score_file_id AS backgroundScoreFileId,
                    s.status AS status,
                    s.allow_rewind AS allowRewind,
                    ss.recurrence_type AS recurrenceType,
                    ss.recurrence_key AS recurrenceKey,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS scheduleStartTime,
                    ss.last_entry_time AS scheduleLastEntryTime,
                    ss.custom_meeting_link AS customMeetingLink,
                    ss.custom_waiting_room_media_id AS customWaitingRoomMediaId,
                    ss.thumbnail_file_id AS scheduleThumbnailFileId,  -- NEW
                    ss.daily_attendance AS dailyAttendance,           -- NEW
                    s.allow_play_pause As allowPlayPause,
                    COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
                    ss.provider_host_url AS providerHostUrl,
                    ss.provider_meeting_id AS providerMeetingId
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE ss.id = :scheduleId
                LIMIT 1
            """, nativeQuery = true)
    Optional<ScheduleDetailsProjection> findScheduleDetailsById(@Param("scheduleId") String scheduleId);

    @Query(value = """
                SELECT ss.id
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE ss.session_id = :sessionId
                  AND ss.status != 'DELETED'
                  AND (
                      -- Future schedules (meeting date + start time > current time in session timezone)
                      CAST((ss.meeting_date + ss.start_time) AS TIMESTAMP)
                      > CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS TIMESTAMP)
                      OR
                      -- Current/active schedules (started but still accepting entries)
                      (
                          CAST((ss.meeting_date + ss.start_time) AS TIMESTAMP)
                          <= CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS TIMESTAMP)
                          AND (
                              ss.last_entry_time IS NULL
                              OR CAST((ss.meeting_date + ss.last_entry_time) AS TIMESTAMP)
                              >= CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS TIMESTAMP)
                          )
                      )
                  )
                ORDER BY ss.meeting_date ASC, ss.start_time ASC
                LIMIT 1
            """, nativeQuery = true)
    String findEarliestScheduleIdBySessionId(@Param("sessionId") String sessionId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE session_schedules SET status = 'DELETED' WHERE id IN (:ids)", nativeQuery = true)
    int softDeleteScheduleByIdIn(@Param("ids") List<String> ids);

    @Modifying
    @Transactional
    @Query(value = "UPDATE session_schedules SET status = 'DELETED' WHERE session_id =:id", nativeQuery = true)
    int softDeleteScheduleBySessionId(@Param("id") String id);

    @Query(value = "SELECT session_id FROM session_schedules WHERE id = :scheduleId AND status <> :status", nativeQuery = true)
    String findSessionIdByScheduleId(@Param("scheduleId") String scheduleId, @Param("status") String status);

    @Query(value = "SELECT COUNT(*) FROM session_schedules WHERE session_id = :sessionId AND status <> :status", nativeQuery = true)
    int countActiveSchedulesBySessionId(@Param("sessionId") String sessionId, @Param("status") String status);

    @Query(value = "SELECT id FROM session_schedules WHERE session_id = :sessionId AND status <> :status", nativeQuery = true)
    List<String> findScheduleIdsBySessionId(@Param("sessionId") String sessionId, @Param("status") String status);

    // Check for conflicts with user schedules
    @Query(value = """
                SELECT DISTINCT
                    s.id AS sessionId,
                    ss.id AS scheduleId,
                    s.title AS title,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS startTime,
                    ss.last_entry_time AS endTime,
                    lsp.source_id AS conflictingUserId
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                JOIN live_session_participants lsp ON lsp.session_id = s.id
                WHERE lsp.source_type = 'USER'
                  AND lsp.source_id IN :userIds
                  AND ss.meeting_date BETWEEN :startDate AND :endDate
                  AND ss.status != 'DELETED'
                  AND ss.status != 'CANCELLED'
                  AND s.status != 'DELETED'
                  AND (:excludeSessionId IS NULL OR s.id != :excludeSessionId)
                  AND (
                      (:startTime IS NULL AND :endTime IS NULL)
                      OR (
                          ss.start_time < :endTime AND ss.last_entry_time > :startTime
                      )
                  )
                ORDER BY ss.meeting_date, ss.start_time
            """, nativeQuery = true)
    List<Object[]> findConflictingSchedulesForUsers(
            @Param("userIds") List<String> userIds,
            @Param("startDate") java.sql.Date startDate,
            @Param("endDate") java.sql.Date endDate,
            @Param("startTime") java.sql.Time startTime,
            @Param("endTime") java.sql.Time endTime,
            @Param("excludeSessionId") String excludeSessionId);

    // Check for conflicts with resource (source/sourceId)
    @Query(value = """
                SELECT DISTINCT
                    s.id AS sessionId,
                    ss.id AS scheduleId,
                    s.title AS title,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS startTime,
                    ss.last_entry_time AS endTime,
                    s.source AS conflictingSource,
                    s.source_id AS conflictingSourceId
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE s.source = :source
                  AND s.source_id = :sourceId
                  AND ss.meeting_date BETWEEN :startDate AND :endDate
                  AND ss.status != 'DELETED'
                  AND ss.status != 'CANCELLED'
                  AND s.status != 'DELETED'
                  AND (:excludeSessionId IS NULL OR s.id != :excludeSessionId)
                  AND (
                      (:startTime IS NULL AND :endTime IS NULL)
                      OR (
                          ss.start_time < :endTime AND ss.last_entry_time > :startTime
                      )
                  )
                ORDER BY ss.meeting_date, ss.start_time
            """, nativeQuery = true)
    List<Object[]> findConflictingSchedulesForResource(
            @Param("source") String source,
            @Param("sourceId") String sourceId,
            @Param("startDate") java.sql.Date startDate,
            @Param("endDate") java.sql.Date endDate,
            @Param("startTime") java.sql.Time startTime,
            @Param("endTime") java.sql.Time endTime,
            @Param("excludeSessionId") String excludeSessionId);

    /**
     * Other meetings booked on the SAME provider account that overlap a given
     * time slot — the signal for double-booking (a single Zoom S2S account = one
     * host = one concurrent meeting). Same overlap idiom as
     * {@link #findConflictingSchedulesForResource}, keyed on the generic
     * {@code provider_account_id} so any multi-account provider can reuse it.
     * Returns rows: [sessionId, scheduleId, title, meetingDate, startTime, endTime].
     */
    @Query(value = """
                SELECT DISTINCT
                    s.id AS sessionId,
                    ss.id AS scheduleId,
                    s.title AS title,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS startTime,
                    ss.last_entry_time AS endTime
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE ss.provider_account_id = :providerAccountId
                  AND ss.meeting_date = :meetingDate
                  AND ss.status != 'DELETED'
                  AND ss.status != 'CANCELLED'
                  AND s.status != 'DELETED'
                  AND (:excludeScheduleId IS NULL OR ss.id != :excludeScheduleId)
                  AND (:excludeSessionId IS NULL OR s.id != :excludeSessionId)
                  AND ss.start_time < :endTime
                  AND ss.last_entry_time > :startTime
                ORDER BY ss.start_time
            """, nativeQuery = true)
    List<Object[]> findOverlappingSchedulesByProviderAccount(
            @Param("providerAccountId") String providerAccountId,
            @Param("meetingDate") java.sql.Date meetingDate,
            @Param("startTime") java.sql.Time startTime,
            @Param("endTime") java.sql.Time endTime,
            @Param("excludeScheduleId") String excludeScheduleId,
            @Param("excludeSessionId") String excludeSessionId);

    // Get calendar events for a user
    @Query(value = """
                SELECT
                    s.id AS sessionId,
                    ss.id AS scheduleId,
                    s.title AS title,
                    s.subject AS subject,
                    ss.meeting_date AS meetingDate,
                    ss.start_time AS startTime,
                    ss.last_entry_time AS endTime,
                    s.status AS status,
                    s.booking_type_id AS bookingTypeId,
                    bt.type AS bookingTypeName,
                    s.source AS source,
                    s.source_id AS sourceId,
                    COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink,
                    s.access_level AS accessLevel,
                    COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone
                FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                JOIN live_session_participants lsp ON lsp.session_id = s.id
                LEFT JOIN booking_types bt ON s.booking_type_id = bt.id
                WHERE lsp.source_type = 'USER'
                  AND lsp.source_id = :userId
                  AND ss.meeting_date BETWEEN :startDate AND :endDate
                  AND ss.status != 'DELETED'
                  AND s.status != 'DELETED'
                ORDER BY ss.meeting_date, ss.start_time
            """, nativeQuery = true)
    List<Object[]> findCalendarEventsForUser(
            @Param("userId") String userId,
            @Param("startDate") java.sql.Date startDate,
            @Param("endDate") java.sql.Date endDate);

    @Modifying
    @Transactional
    @Query(value = "UPDATE session_schedules SET status = :status WHERE id = :scheduleId", nativeQuery = true)
    int updateScheduleStatus(@Param("scheduleId") String scheduleId, @Param("status") String status);

    @Modifying
    @Transactional
    @Query(value = "UPDATE session_schedules SET meeting_date = :newDate, start_time = :newStartTime, last_entry_time = :newEndTime WHERE id = :scheduleId", nativeQuery = true)
    int reschedule(
            @Param("scheduleId") String scheduleId,
            @Param("newDate") java.sql.Date newDate,
            @Param("newStartTime") java.sql.Time newStartTime,
            @Param("newEndTime") java.sql.Time newEndTime);

    /**
     * Used by the hourly provider sync scheduler.
     * Returns schedules that have a provider meeting ID set for the given provider
     * and whose attendance hasn't been synced recently.
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session ls ON ls.id = ss.session_id
                WHERE ss.provider_meeting_id IS NOT NULL
                  AND (ls.link_type = :provider OR ls.link_type = :providerAlt)
                  AND ss.status != 'DELETED'
                  AND (ss.last_attendance_sync_at IS NULL OR ss.last_attendance_sync_at < :before)
            """, nativeQuery = true)
    List<SessionSchedule> findNeedingAttendanceSync(
            @Param("provider") String provider,
            @Param("providerAlt") String providerAlt,
            @Param("before") java.util.Date before);

    /**
     * Attendance-poll candidates bounded to recently-ENDED meetings (Zoom's
     * past-meeting participant report only exists after a meeting ends, and we
     * don't want to re-poll ancient meetings forever). Same shape as
     * {@link #findNeedingAttendanceSync} plus an "ended" + "not older than
     * earliestDate" bound.
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session ls ON ls.id = ss.session_id
                WHERE ss.provider_meeting_id IS NOT NULL
                  AND (ls.link_type = :provider OR ls.link_type = :providerAlt)
                  AND ss.status != 'DELETED'
                  AND (ss.last_attendance_sync_at IS NULL OR ss.last_attendance_sync_at < :before)
                  AND ss.meeting_date >= :earliestDate
                  AND (
                      ss.meeting_date < CURRENT_DATE
                      OR (ss.meeting_date = CURRENT_DATE AND ss.last_entry_time < CURRENT_TIME)
                  )
            """, nativeQuery = true)
    List<SessionSchedule> findEndedSchedulesNeedingAttendanceSync(
            @Param("provider") String provider,
            @Param("providerAlt") String providerAlt,
            @Param("before") java.util.Date before,
            @Param("earliestDate") java.sql.Date earliestDate);

    /**
     * Zoom schedules that still hold un-mirrored cloud recordings (JSON contains a
     * {@code ZOOM_CLOUD}-tagged entry). Drives the near-expiry S3-mirror rescue job.
     * The LIKE bound keeps the scan to schedules with something left to mirror.
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session ls ON ls.id = ss.session_id
                WHERE (ls.link_type = :provider OR ls.link_type = :providerAlt)
                  AND ss.status != 'DELETED'
                  AND ss.provider_recordings_json IS NOT NULL
                  AND ss.provider_recordings_json LIKE '%ZOOM_CLOUD%'
            """, nativeQuery = true)
    List<SessionSchedule> findZoomSchedulesWithCloudRecordings(
            @Param("provider") String provider,
            @Param("providerAlt") String providerAlt);

    /**
     * Used by the hourly provider sync scheduler.
     * Returns schedules that have a provider meeting ID set for the given provider
     * and whose recordings haven't been synced recently.
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session ls ON ls.id = ss.session_id
                WHERE ss.provider_meeting_id IS NOT NULL
                  AND (ls.link_type = :provider OR ls.link_type = :providerAlt)
                  AND ss.status != 'DELETED'
                  AND (
                      ss.last_recording_sync_at IS NULL
                      OR ss.last_recording_sync_at < :before
                      OR (ss.provider_recordings_json IS NOT NULL AND ss.provider_recordings_json LIKE '%"playbackUrl":null%')
                  )
                  AND (
                      ss.meeting_date < CURRENT_DATE
                      OR (ss.meeting_date = CURRENT_DATE AND ss.last_entry_time < CURRENT_TIME)
                  )
            """, nativeQuery = true)
    List<SessionSchedule> findNeedingRecordingSync(
            @Param("provider") String provider,
            @Param("providerAlt") String providerAlt,
            @Param("before") java.util.Date before);

    /**
     * Fetches the institute_id for a given schedule by joining through
     * live_session.
     * Used by the sync scheduler to resolve instituteId from a SessionSchedule.
     */
    @Query(value = """
                SELECT ls.institute_id
                FROM session_schedules ss
                JOIN live_session ls ON ls.id = ss.session_id
                WHERE ss.id = :scheduleId
            """, nativeQuery = true)
    Optional<String> findInstituteIdByScheduleId(@Param("scheduleId") String scheduleId);

    /**
     * Returns all schedules that have at least one recording entry.
     * Used by the daily recording cleanup job to find BBB recordings to delete.
     */
    @Query(value = """
                SELECT * FROM session_schedules
                WHERE provider_recordings_json IS NOT NULL
                  AND provider_recordings_json != '[]'
                  AND provider_recordings_json != ''
            """, nativeQuery = true)
    List<SessionSchedule> findAllWithRecordings();

    /**
     * Returns schedules whose end (meeting_date + last_entry_time, interpreted in
     * the session's timezone) fell strictly within {@code (now - lookbackMinutes,
     * now]} — i.e. candidates for the LIVE_SESSION_END workflow trigger.
     * Comparison is done on wall-clock time in the session timezone, mirroring
     * the pattern in {@code findEarliestScheduleIdBySessionId}.
     *
     * <p>Called from {@code LiveSessionNotificationProcessor#processDueNotifications}
     * (cadence: every 5 min via Quartz). The lookback window MUST equal the
     * cadence and the lower bound MUST be exclusive — otherwise consecutive
     * ticks' windows overlap and the same class fires twice. The workflow
     * engine's default idempotency strategy is UUID (see
     * WorkflowBuilderService:217), which generates a fresh key per call and
     * does NOT dedupe duplicate fires, so we cannot rely on it as a backstop.
     *
     * <p>The {@code meeting_date BETWEEN current_date - 1 AND current_date + 1}
     * pre-filter is a performance guardrail: the timezone-aware comparison on
     * {@code (meeting_date + last_entry_time)} can't use any index, so without
     * pre-filtering the planner sequential-scans every row in
     * {@code session_schedules}. Bounding by {@code meeting_date} (typically
     * indexed) limits the scan to today's rows even on a large multi-tenant
     * table. The +/-1 day window is wide enough to cover every IANA timezone
     * (Hawaii UTC-10 to Kiribati UTC+14, total span 24h).
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE ss.meeting_date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND (CURRENT_DATE + INTERVAL '1 day')
                  AND ss.last_entry_time IS NOT NULL
                  AND COALESCE(ss.status, '') <> 'DELETED'
                  AND COALESCE(s.status, '') <> 'DELETED'
                  AND CAST((ss.meeting_date + ss.last_entry_time) AS TIMESTAMP)
                          > (CAST(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS TIMESTAMP)
                                - (INTERVAL '1 minute' * :lookbackMinutes))
                  AND CAST((ss.meeting_date + ss.last_entry_time) AS TIMESTAMP)
                          <= CAST(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS TIMESTAMP)
            """, nativeQuery = true)
    List<SessionSchedule> findEndedInLastMinutes(@Param("lookbackMinutes") int lookbackMinutes);

    /**
     * Schedules whose START time fell in the half-open window
     * {@code (now - :lookbackMinutes minutes, now]} — i.e. candidates for the
     * LIVE_SESSION_START workflow trigger. Sibling of
     * {@link #findEndedInLastMinutes(int)}; same timezone-aware semantics, but
     * compares against {@code start_time} instead of {@code last_entry_time}.
     *
     * <p>Called from {@code LiveSessionNotificationProcessor#processDueNotifications}
     * (every 5 min via Quartz). The lookback window MUST equal the Quartz
     * cadence and the lower bound MUST be exclusive — otherwise consecutive
     * ticks' windows overlap and the same class fires twice. Cross-tick / cross-replica
     * dedup is then handled by the workflow engine's EVENT_BASED idempotency
     * strategy (see {@code WorkflowBuilderService.isPeriodicScanTrigger}).
     *
     * <p>The {@code meeting_date BETWEEN current_date - 1 AND current_date + 1}
     * pre-filter is the same performance guardrail used by the END query.
     */
    @Query(value = """
                SELECT ss.* FROM session_schedules ss
                JOIN live_session s ON ss.session_id = s.id
                WHERE ss.meeting_date BETWEEN (CURRENT_DATE - INTERVAL '1 day') AND (CURRENT_DATE + INTERVAL '1 day')
                  AND ss.start_time IS NOT NULL
                  AND COALESCE(ss.status, '') <> 'DELETED'
                  AND COALESCE(s.status, '') <> 'DELETED'
                  AND CAST((ss.meeting_date + ss.start_time) AS TIMESTAMP)
                          > (CAST(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS TIMESTAMP)
                                - (INTERVAL '1 minute' * :lookbackMinutes))
                  AND CAST((ss.meeting_date + ss.start_time) AS TIMESTAMP)
                          <= CAST(CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS TIMESTAMP)
            """, nativeQuery = true)
    List<SessionSchedule> findStartedInLastMinutes(@Param("lookbackMinutes") int lookbackMinutes);

}
