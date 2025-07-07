package vacademy.io.admin_core_service.features.live_session.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.ScheduleDTO;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.presentation_mode.learner.dto.LiveSessionDto;

import java.sql.Time;
import java.sql.Timestamp;
import java.sql.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SessionScheduleRepository extends JpaRepository<SessionSchedule, String> {

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
        String getThumbnailFileId();
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
        s.waiting_room_link AS waitingRoomLink,
        s.waiting_room_time AS waitingRoomTime,
        s.registration_form_link_for_public_sessions AS registrationFormLinkForPublicSessions,
        s.created_by_user_id AS createdByUserId,
        s.description_html AS descriptionHtml,
        s.notification_email_message AS notificationEmailMessage,
        s.attendance_email_message AS attendanceEmailMessage,
        s.cover_file_id AS coverFileId,
        s.thumbnail_file_id AS thumbnailFileId,
        s.background_score_file_id AS backgroundScoreFileId
    FROM live_session s
    LEFT JOIN session_schedules ss ON s.id = ss.session_id
    WHERE s.id = :sessionId
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
            s.waiting_room_link AS waitingRoomLink,
            s.waiting_room_time AS waitingRoomTime,
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
            ss.custom_waiting_room_media_id AS customWaitingRoomMediaId
        FROM session_schedules ss
        JOIN live_session s ON ss.session_id = s.id
        WHERE ss.id = :scheduleId
        LIMIT 1
    """, nativeQuery = true)
        Optional<ScheduleDetailsProjection> findScheduleDetailsById(@Param("scheduleId") String scheduleId);


    @Query(value = """
        SELECT id
        FROM session_schedules
        WHERE session_id = :sessionId
        ORDER BY meeting_date ASC, start_time ASC
        LIMIT 1
    """, nativeQuery = true)
    String findEarliestScheduleIdBySessionId(@Param("sessionId") String sessionId);
}