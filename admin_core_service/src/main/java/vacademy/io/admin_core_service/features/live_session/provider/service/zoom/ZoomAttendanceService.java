package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.enums.SessionLog;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;

import java.sql.Timestamp;
import java.time.Instant;
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
