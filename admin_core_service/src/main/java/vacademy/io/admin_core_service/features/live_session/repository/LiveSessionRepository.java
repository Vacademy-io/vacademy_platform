package vacademy.io.admin_core_service.features.live_session.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import java.util.List;

@Repository
public interface LiveSessionRepository extends JpaRepository<LiveSession, String>, LiveSessionRepositoryCustom {

    public interface LiveSessionListProjection {
        String getSessionId();
        Integer getWaitingRoomTime();
        String getThumbnailFileId();
        String getBackgroundScoreFileId();
        String getSessionStreamingServiceType();
        String getScheduleId();
        java.sql.Date getMeetingDate();
        java.sql.Time getStartTime();
        java.sql.Time getLastEntryTime();
        String getRecurrenceType();
        String getAccessLevel();
        String getTitle();
        String getSubject();
        String getMeetingLink();
        String getRegistrationFormLinkForPublicSessions();
        Boolean getAllowPlayPause();
        String getTimezone();
        String getLearnerButtonConfig();
        String getDefaultClassLink();
        String getDefaultClassName();
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
        COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink,
        s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
        s.allow_play_pause AS allowPlayPause,
        COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
        ss.default_class_link AS defaultClassLink,
        ss.default_class_name AS defaultClassName
    FROM live_session s
    JOIN session_schedules ss ON s.id = ss.session_id
    WHERE s.status = 'LIVE'
      AND ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date)
      AND s.institute_id = :instituteId
      AND ss.status != 'DELETED'
""", nativeQuery = true)
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
        COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink,
        s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
        s.allow_play_pause AS allowPlayPause,
        COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
        ss.learner_button_config AS learnerButtonConfig,
        ss.default_class_link AS defaultClassLink,
        ss.default_class_name AS defaultClassName
    FROM live_session s
    JOIN session_schedules ss ON s.id = ss.session_id
    WHERE s.status = 'LIVE'
    AND (
            ss.meeting_date > CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date)
                    OR (ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date) 
                        AND CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS time) < ss.start_time)
          )
    AND s.institute_id = :instituteId
    AND ss.status != 'DELETED'
    ORDER BY ss.meeting_date ASC, ss.start_time ASC
""", nativeQuery = true)
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
        COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink,
        s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
        s.allow_play_pause AS allowPlayPause,
        COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
        ss.default_class_link AS defaultClassLink,
        ss.default_class_name AS defaultClassName,
        ss.learner_button_config AS learnerButtonConfig
    FROM live_session s
    JOIN session_schedules ss ON s.id = ss.session_id
    WHERE s.status = 'LIVE'
      AND (
            ss.meeting_date < CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date)
            OR (ss.meeting_date = CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date) 
                AND CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS time) > ss.last_entry_time)
          )
      AND s.institute_id = :instituteId
      AND ss.status != 'DELETED'
    ORDER BY ss.meeting_date ASC, ss.start_time ASC
    """, nativeQuery = true)
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
        COALESCE(ss.custom_meeting_link, s.default_meet_link) AS meetingLink,
        s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
        s.allow_play_pause AS allowPlayPause,
        COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
        ss.default_class_link AS defaultClassLink,
        ss.default_class_name AS defaultClassName
    FROM live_session s
    JOIN session_schedules ss ON s.id = ss.session_id
    WHERE s.status = 'DRAFT'
    AND s.institute_id = :instituteId
    AND ss.status != 'DELETED'
    """, nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findDraftedSessions(@Param("instituteId") String instituteId);

    @Query(value = """
        SELECT DISTINCT
            s.id AS sessionId,
            s.waiting_room_time AS waitingRoomTime,
            s.thumbnail_file_id AS thumbnailFileId,
            s.background_score_file_id AS backgroundScoreFileId,
            s.session_streaming_service_type AS sessionStreamingServiceType,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
            s.allow_play_pause AS allowPlayPause,
            COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
            CASE
                WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' THEN ss.custom_meeting_link
                ELSE s.default_meet_link
            END AS meetingLink,
            ss.learner_button_config AS learnerButtonConfig,
            ss.default_class_link AS defaultClassLink,
            ss.default_class_name AS defaultClassName
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        JOIN live_session_participants lsp ON lsp.session_id = s.id
        WHERE lsp.source_type = 'BATCH'
          AND lsp.source_id = :batchId
          AND ss.meeting_date >= CAST((CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata')) AS date)
          AND s.status IN ('DRAFT', 'LIVE')
          AND ss.status != 'DELETED'
        ORDER BY ss.meeting_date, ss.start_time
    """, nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessionsForBatch(@Param("batchId") String batchId);

    @Query(value = """
        SELECT DISTINCT
            s.id AS sessionId,
            s.waiting_room_time AS waitingRoomTime,
            s.thumbnail_file_id AS thumbnailFileId,
            s.background_score_file_id AS backgroundScoreFileId,
            s.session_streaming_service_type AS sessionStreamingServiceType,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
            s.allow_play_pause AS allowPlayPause,
            COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
            CASE
                WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' THEN ss.custom_meeting_link
                ELSE s.default_meet_link
            END AS meetingLink,
            ss.learner_button_config AS learnerButtonConfig,
            ss.default_class_link AS defaultClassLink,
            ss.default_class_name AS defaultClassName
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        JOIN live_session_participants lsp ON lsp.session_id = s.id
        WHERE lsp.source_type = 'USER'
          AND lsp.source_id = :userId
          AND ss.meeting_date >= CURRENT_DATE
          AND s.status IN ('DRAFT', 'LIVE')
          AND ss.status != 'DELETED'
        ORDER BY ss.meeting_date, ss.start_time
    """, nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessionsForUser(@Param("userId") String userId);

    @Query(value = """
        SELECT DISTINCT
            s.id AS sessionId,
            s.waiting_room_time AS waitingRoomTime,
            s.thumbnail_file_id AS thumbnailFileId,
            s.background_score_file_id AS backgroundScoreFileId,
            s.session_streaming_service_type AS sessionStreamingServiceType,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
            s.allow_play_pause AS allowPlayPause,
            COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
            CASE
                WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' THEN ss.custom_meeting_link
                ELSE s.default_meet_link
            END AS meetingLink,
            ss.learner_button_config AS learnerButtonConfig,
            ss.default_class_link AS defaultClassLink,
            ss.default_class_name AS defaultClassName
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        JOIN live_session_participants lsp ON lsp.session_id = s.id
        WHERE (
            (:batchId IS NOT NULL AND lsp.source_type = 'BATCH' AND lsp.source_id = :batchId)
            OR 
            (:userId IS NOT NULL AND lsp.source_type = 'USER' AND lsp.source_id = :userId)
        )
        AND ss.meeting_date >= CURRENT_DATE
        AND s.status IN ('DRAFT', 'LIVE')
        AND ss.status != 'DELETED'
        ORDER BY ss.meeting_date, ss.start_time
    """, nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessionsForUserAndBatch(
        @Param("batchId") String batchId,
        @Param("userId") String userId
    );

    @Query(value = """
        SELECT DISTINCT
            s.id AS sessionId,
            s.waiting_room_time AS waitingRoomTime,
            s.thumbnail_file_id AS thumbnailFileId,
            s.background_score_file_id AS backgroundScoreFileId,
            s.session_streaming_service_type AS sessionStreamingServiceType,
            ss.id AS scheduleId,
            ss.meeting_date AS meetingDate,
            ss.start_time AS startTime,
            ss.last_entry_time AS lastEntryTime,
            ss.recurrence_type AS recurrenceType,
            s.access_level AS accessLevel,
            s.title AS title,
            s.subject AS subject,
            s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
            s.allow_play_pause AS allowPlayPause,
            COALESCE(NULLIF(s.timezone, ''), 'Asia/Kolkata') AS timezone,
            CASE
                WHEN ss.custom_meeting_link IS NOT NULL AND ss.custom_meeting_link <> '' THEN ss.custom_meeting_link
                ELSE s.default_meet_link
            END AS meetingLink,
            ss.learner_button_config AS learnerButtonConfig,
            ss.default_class_link AS defaultClassLink,
            ss.default_class_name AS defaultClassName
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        JOIN live_session_participants lsp ON lsp.session_id = s.id
        WHERE (
            (:batchId IS NOT NULL AND lsp.source_type = 'BATCH' AND lsp.source_id = :batchId)
            OR 
            (:userId IS NOT NULL AND lsp.source_type = 'USER' AND lsp.source_id = :userId)
        )
        AND ss.meeting_date >= COALESCE(CAST(:startDate AS DATE), CURRENT_DATE)
        AND (:endDate IS NULL OR ss.meeting_date <= CAST(:endDate AS DATE))
        AND s.status IN ('DRAFT', 'LIVE')
        AND ss.status != 'DELETED'
        ORDER BY ss.meeting_date, ss.start_time
        LIMIT CASE WHEN :size IS NULL THEN NULL ELSE :size END
        OFFSET CASE WHEN :offset IS NULL THEN 0 ELSE :offset END
    """, nativeQuery = true)
    List<LiveSessionRepository.LiveSessionListProjection> findUpcomingSessionsForUserAndBatchWithFilters(
        @Param("batchId") String batchId,
        @Param("userId") String userId,
        @Param("startDate") String startDate,
        @Param("endDate") String endDate,
        @Param("offset") Integer offset,
        @Param("size") Integer size
    );

    @Modifying
    @Transactional
    @Query(value = "UPDATE live_session SET status = 'DELETED' WHERE id = :sessionId", nativeQuery = true)
    void softDeleteLiveSessionById(@Param("sessionId") String sessionId);
}
