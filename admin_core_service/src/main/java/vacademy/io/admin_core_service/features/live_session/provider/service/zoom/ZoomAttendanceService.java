package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.manager.ZoomMeetingManager;
import vacademy.io.admin_core_service.features.live_session.provider.service.zoom.ZoomAccountStore;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Records learner attendance for Zoom sessions.
 *
 * Primary attendance is captured at join time (when the learner fetches the SDK
 * signature or native join payload) — the same approach BBB uses at join-URL
 * generation. This is reliable because the request is authenticated, so we know
 * exactly which user is joining; it doesn't depend on correlating Zoom webhook
 * participants back to our users.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomAttendanceService {

    private final LiveSessionLogsRepository liveSessionLogsRepository;
    private final ZoomAccountStore zoomAccountStore;
    private final ZoomMeetingManager zoomMeetingManager;
    private final LiveSessionParticipantRepository participantRepository;
    private final SessionScheduleRepository scheduleRepository;

    /**
     * Polling fallback: pulls Zoom's post-meeting participant report and records
     * attendance with duration. Complements the join-time {@link #markPresent}
     * (which catches authenticated SDK/native joins but misses raw-URL/guest joins
     * and never has duration).
     *
     * <b>Idempotent across repeated polls:</b> Zoom's report is cumulative per
     * meeting, so duration is SET (not summed) to the report's total — re-running
     * converges rather than double-counting. Rejoin segments within one report are
     * summed per participant. Each attendee's email is resolved to an enrolled
     * user (USER record, surfaces in reports); unmatched emails are kept as
     * {@code PROVIDER_EMAIL} guest records.
     *
     * @return number of attendee records upserted
     */
    public int syncAttendance(SessionSchedule schedule) {
        if (schedule.getProviderMeetingId() == null || schedule.getProviderMeetingId().isBlank()
                || schedule.getProviderAccountId() == null || schedule.getProviderAccountId().isBlank()) {
            return 0;
        }
        ZoomAccount account = zoomAccountStore.findById(schedule.getProviderAccountId()).orElse(null);
        if (account == null) {
            return 0;
        }

        List<MeetingAttendeeDTO> attendees =
                zoomMeetingManager.fetchAttendance(account, schedule.getProviderMeetingId());

        // Aggregate by email within this report: sum rejoin-segment durations,
        // keep the earliest join time and a display name.
        Map<String, Aggregate> byEmail = new LinkedHashMap<>();
        for (MeetingAttendeeDTO a : attendees) {
            if (a.getEmail() == null || a.getEmail().isBlank()) {
                continue; // can't correlate an attendee with no email
            }
            String email = a.getEmail().trim().toLowerCase();
            Aggregate agg = byEmail.computeIfAbsent(email, k -> new Aggregate());
            agg.durationMinutes += Math.max(0, a.getDurationMinutes());
            if (a.getName() != null && !a.getName().isBlank()) {
                agg.name = a.getName();
            }
            if (agg.joinTime == null && a.getJoinTime() != null) {
                agg.joinTime = a.getJoinTime();
            }
        }

        Timestamp now = new Timestamp(System.currentTimeMillis());
        int upserts = 0;
        for (Map.Entry<String, Aggregate> entry : byEmail.entrySet()) {
            String email = entry.getKey();
            Aggregate agg = entry.getValue();
            List<String> userIds = participantRepository.findEnrolledUserIdByEmail(schedule.getSessionId(), email);
            if (!userIds.isEmpty()) {
                upsertAttendance(schedule, "USER", userIds.get(0), agg, now);
            } else {
                // Guest / email not matching any enrolled participant.
                upsertAttendance(schedule, "PROVIDER_EMAIL", email, agg, now);
            }
            upserts++;
        }

        schedule.setLastAttendanceSyncAt(new Date());
        scheduleRepository.save(schedule);
        return upserts;
    }

    private void upsertAttendance(SessionSchedule schedule, String sourceType, String sourceId,
                                  Aggregate agg, Timestamp now) {
        Optional<LiveSessionLogs> existing = "PROVIDER_EMAIL".equals(sourceType)
                ? liveSessionLogsRepository.findExistingProviderAttendanceRecord(schedule.getId(), sourceId)
                : liveSessionLogsRepository.findExistingAttendanceRecord(schedule.getId(), sourceId);

        if (existing.isPresent()) {
            LiveSessionLogs log = existing.get();
            // SET (not sum) — Zoom's report is cumulative, so re-polls converge.
            log.setProviderTotalDurationMinutes(agg.durationMinutes);
            if (agg.joinTime != null && (log.getProviderJoinTime() == null || log.getProviderJoinTime().isBlank())) {
                log.setProviderJoinTime(agg.joinTime);
            }
            log.setProviderMeetingId(schedule.getProviderMeetingId());
            log.setStatus("PRESENT");
            log.setStatusType("ONLINE");
            log.setUpdatedAt(now);
            liveSessionLogsRepository.save(log);
        } else {
            LiveSessionLogs entry = LiveSessionLogs.builder()
                    .sessionId(schedule.getSessionId())
                    .scheduleId(schedule.getId())
                    .userSourceType(sourceType)
                    .userSourceId(sourceId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details((agg.name != null ? agg.name : "") + " | provider=ZOOM"
                            + ("PROVIDER_EMAIL".equals(sourceType) ? " | guest" : ""))
                    .providerJoinTime(agg.joinTime)
                    .providerMeetingId(schedule.getProviderMeetingId())
                    .providerTotalDurationMinutes(agg.durationMinutes)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            liveSessionLogsRepository.save(entry);
        }
    }

    private static final class Aggregate {
        private String name;
        private String joinTime;
        private int durationMinutes;
    }

    /**
     * Marks a user PRESENT for a schedule (idempotent — updates the existing record
     * on a repeat join rather than inserting a duplicate).
     */
    public void markPresent(String sessionId, String scheduleId, String userId,
                            String fullName, String providerMeetingId) {
        if (scheduleId == null || userId == null) return;

        Optional<LiveSessionLogs> existing =
                liveSessionLogsRepository.findExistingAttendanceRecord(scheduleId, userId);
        String joinTimeIso = Instant.now().toString();
        Timestamp now = new Timestamp(System.currentTimeMillis());

        if (existing.isPresent()) {
            LiveSessionLogs log = existing.get();
            log.setProviderJoinTime(joinTimeIso);
            log.setProviderMeetingId(providerMeetingId);
            log.setStatus("PRESENT");
            log.setStatusType("ONLINE");
            log.setUpdatedAt(now);
            liveSessionLogsRepository.save(log);
        } else {
            LiveSessionLogs entry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(userId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details((fullName != null ? fullName : "") + " | provider=ZOOM")
                    .providerJoinTime(joinTimeIso)
                    .providerMeetingId(providerMeetingId)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            liveSessionLogsRepository.save(entry);
        }
    }
}
