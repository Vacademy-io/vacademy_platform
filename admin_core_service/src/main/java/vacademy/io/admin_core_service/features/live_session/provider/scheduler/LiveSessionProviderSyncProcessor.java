package vacademy.io.admin_core_service.features.live_session.provider.scheduler;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionParticipants;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.LiveSessionParticipantsEnum;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.provider.LiveSessionProviderFactory;
import vacademy.io.admin_core_service.features.live_session.provider.LiveSessionProviderStrategy;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * Hourly processor: syncs recordings + attendee reports from each provider.
 *
 * Attendance sync logic:
 * 1. Zoho gives us attendee email.
 * 2. We look up the student by email + instituteId → get userId.
 * 3. Write live_session_logs with userSourceType='USER', userSourceId=userId
 * (same format as the join-link click attendance — so existing reports work).
 * 4. Upsert live_session_participants with sourceType='USER', sourceId=userId
 * so the student appears in the enrolled list for the session.
 * 5. If email can't be resolved → keep PROVIDER_EMAIL record as fallback
 * (visible in the raw Zoho attendance API but not in the main attendance
 * report).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LiveSessionProviderSyncProcessor {

    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionProviderFactory providerFactory;
    private final LiveSessionLogsRepository liveSessionLogsRepository;
    private final LiveSessionParticipantRepository participantRepository;
    private final InstituteStudentRepository studentRepository;
    private final ObjectMapper objectMapper;

    public void syncAll() {
        for (MeetingProvider provider : MeetingProvider.values()) {
            // BBB server is started/stopped on demand — skip hourly sync.
            // Attendance is tracked at join time; recordings are fetched via end callback.
            if (provider == MeetingProvider.BBB_MEETING) {
                log.debug("[Sync] Skipping BBB_MEETING — attendance tracked at join time");
                continue;
            }
            try {
                syncRecordingsForProvider(provider.name());
                syncAttendanceForProvider(provider.name());
            } catch (Exception e) {
                log.error("[Sync] Error for provider {}: {}", provider.name(), e.getMessage(), e);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Recordings — cached as JSON on session_schedules.provider_recordings_json
    // -----------------------------------------------------------------------

    private void syncRecordingsForProvider(String providerName) {
        Date oneHourAgo = Date.from(Instant.now().minusSeconds(3600));
        List<SessionSchedule> schedules = scheduleRepository.findNeedingRecordingSync(providerName, oneHourAgo);

        log.info("[Sync] {} schedules needing recording sync for {}", schedules.size(), providerName);
        LiveSessionProviderStrategy strategy = getStrategyOrSkip(providerName);
        if (strategy == null)
            return;

        for (SessionSchedule schedule : schedules) {
            try {
                String instituteId = getInstituteId(schedule);
                List<MeetingRecordingDTO> recordings = strategy.getRecordings(schedule.getProviderMeetingId(),
                        instituteId);

                schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(recordings));
                schedule.setLastRecordingSyncAt(new Date());
                scheduleRepository.save(schedule);
                log.info("[Sync] Saved {} recordings for schedule {}", recordings.size(), schedule.getId());
            } catch (Exception e) {
                log.warn("[Sync] Recordings failed for schedule {}: {}", schedule.getId(), e.getMessage());
            }
        }
    }

    // -----------------------------------------------------------------------
    // Attendance
    // -----------------------------------------------------------------------

    private void syncAttendanceForProvider(String providerName) {
        Date oneHourAgo = Date.from(Instant.now().minusSeconds(3600));
        List<SessionSchedule> schedules = scheduleRepository.findNeedingAttendanceSync(providerName, oneHourAgo);

        log.info("[Sync] {} schedules needing attendance sync for {}", schedules.size(), providerName);
        LiveSessionProviderStrategy strategy = getStrategyOrSkip(providerName);
        if (strategy == null)
            return;

        for (SessionSchedule schedule : schedules) {
            try {
                String instituteId = getInstituteId(schedule);
                List<MeetingAttendeeDTO> attendees = strategy.getAttendance(schedule.getProviderMeetingId(),
                        instituteId);

                for (MeetingAttendeeDTO attendee : attendees) {
                    upsertAttendanceLog(schedule, attendee, instituteId);
                }

                schedule.setLastAttendanceSyncAt(new Date());
                scheduleRepository.save(schedule);
                log.info("[Sync] Synced {} attendees for schedule {}", attendees.size(), schedule.getId());
            } catch (Exception e) {
                log.warn("[Sync] Attendance failed for schedule {}: {}", schedule.getId(), e.getMessage());
            }
        }
    }

    /**
     * Core upsert logic:
     *
     * CASE A — email resolves to a known student in the institute:
     * → Write live_session_logs (userSourceType=USER, userSourceId=userId) ← same
     * as join-link click
     * → Upsert live_session_participants (sourceType=USER, sourceId=userId)
     * → Enriches providerJoinTime + providerTotalDurationMinutes on the log
     *
     * CASE B — email NOT found in institute's student list:
     * → Write live_session_logs (userSourceType=PROVIDER_EMAIL, userSourceId=email)
     * → NOT added to live_session_participants (external/unknown attendee)
     * → Still visible via GET /meeting/attendance endpoint
     */
    private void upsertAttendanceLog(SessionSchedule schedule,
            MeetingAttendeeDTO attendee,
            String instituteId) {
        if (attendee.getEmail() == null || attendee.getEmail().isBlank())
            return;

        Optional<Student> studentOpt = studentRepository
                .findTopStudentByEmailAndInstituteIdOrderByMappingCreatedAtDesc(
                        attendee.getEmail(), instituteId);

        if (studentOpt.isPresent()) {
            // ── CASE A: Known student ──────────────────────────────────────────
            String userId = studentOpt.get().getUserId();
            upsertKnownStudentAttendance(schedule, attendee, userId);
            ensureParticipantExists(schedule.getSessionId(), userId);
        } else {
            // ── CASE B: Unknown / external attendee ───────────────────────────
            log.debug("[Sync] Email {} not found in institute {} — storing as PROVIDER_EMAIL",
                    attendee.getEmail(), instituteId);
            upsertProviderEmailAttendance(schedule, attendee);
        }
    }

    /**
     * Upsert a live_session_logs row with userSourceType=USER (matches existing
     * attendance format)
     */
    private void upsertKnownStudentAttendance(SessionSchedule schedule,
            MeetingAttendeeDTO attendee,
            String userId) {
        liveSessionLogsRepository
                .findExistingAttendanceRecord(schedule.getId(), userId)
                .ifPresentOrElse(
                        existing -> {
                            // Keep max duration — student may have joined multiple times
                            int currentDuration = existing.getProviderTotalDurationMinutes() != null
                                    ? existing.getProviderTotalDurationMinutes()
                                    : 0;
                            existing.setProviderTotalDurationMinutes(
                                    Math.max(currentDuration, attendee.getDurationMinutes()));
                            existing.setProviderJoinTime(attendee.getJoinTime());
                            existing.setStatus("PRESENT");
                            existing.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
                            liveSessionLogsRepository.save(existing);
                        },
                        () -> {
                            LiveSessionLogs newLog = LiveSessionLogs.builder()
                                    .sessionId(schedule.getSessionId())
                                    .scheduleId(schedule.getId())
                                    .userSourceType(LiveSessionParticipantsEnum.USER.name())
                                    .userSourceId(userId)
                                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                                    .status("PRESENT")
                                    .details(attendee.getName())
                                    .providerJoinTime(attendee.getJoinTime())
                                    .providerTotalDurationMinutes(attendee.getDurationMinutes())
                                    .createdAt(new Timestamp(System.currentTimeMillis()))
                                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                                    .build();
                            liveSessionLogsRepository.save(newLog);
                        });
    }

    /**
     * Upsert a live_session_logs row with userSourceType=PROVIDER_EMAIL (fallback)
     */
    private void upsertProviderEmailAttendance(SessionSchedule schedule, MeetingAttendeeDTO attendee) {
        liveSessionLogsRepository
                .findExistingProviderAttendanceRecord(schedule.getId(), attendee.getEmail())
                .ifPresentOrElse(
                        existing -> {
                            int currentDuration = existing.getProviderTotalDurationMinutes() != null
                                    ? existing.getProviderTotalDurationMinutes()
                                    : 0;
                            existing.setProviderTotalDurationMinutes(
                                    Math.max(currentDuration, attendee.getDurationMinutes()));
                            existing.setProviderJoinTime(attendee.getJoinTime());
                            existing.setStatus("PRESENT");
                            existing.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
                            liveSessionLogsRepository.save(existing);
                        },
                        () -> {
                            LiveSessionLogs newLog = LiveSessionLogs.builder()
                                    .sessionId(schedule.getSessionId())
                                    .scheduleId(schedule.getId())
                                    .userSourceType("PROVIDER_EMAIL")
                                    .userSourceId(attendee.getEmail())
                                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                                    .status("PRESENT")
                                    .details(attendee.getName())
                                    .providerJoinTime(attendee.getJoinTime())
                                    .providerTotalDurationMinutes(attendee.getDurationMinutes())
                                    .createdAt(new Timestamp(System.currentTimeMillis()))
                                    .updatedAt(new Timestamp(System.currentTimeMillis()))
                                    .build();
                            liveSessionLogsRepository.save(newLog);
                        });
    }

    /**
     * Ensure the student is in live_session_participants for this session.
     * This is idempotent — if they already joined via the join link they're already
     * here.
     * If they joined via Zoho directly (e.g. host invited them), this adds them.
     */
    private void ensureParticipantExists(String sessionId, String userId) {
        boolean exists = participantRepository.existsBySessionIdAndSourceTypeAndSourceId(
                sessionId, LiveSessionParticipantsEnum.USER.name(), userId);
        if (!exists) {
            LiveSessionParticipants participant = LiveSessionParticipants.builder()
                    .sessionId(sessionId)
                    .sourceType(LiveSessionParticipantsEnum.USER.name())
                    .sourceId(userId)
                    .build();
            participantRepository.save(participant);
            log.info("[Sync] Added user {} to live_session_participants for session {}", userId, sessionId);
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private String getInstituteId(SessionSchedule schedule) {
        return scheduleRepository.findInstituteIdByScheduleId(schedule.getId())
                .orElseThrow(() -> new RuntimeException(
                        "Could not resolve instituteId for schedule: " + schedule.getId()));
    }

    private LiveSessionProviderStrategy getStrategyOrSkip(String providerName) {
        try {
            return providerFactory.getStrategy(providerName);
        } catch (Exception e) {
            log.warn("[Sync] No strategy for provider '{}', skipping", providerName);
            return null;
        }
    }
}
