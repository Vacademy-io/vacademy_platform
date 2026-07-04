package vacademy.io.admin_core_service.features.live_session.provider.service.google;

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
 * Records learner attendance for Google Meet sessions.
 *
 * Because Google Meet has no embeddable SDK, the PRIMARY attendance signal is captured at the
 * authenticated "Join Google Meet" click ({@link #markPresent}) — reliable because the request
 * carries the learner's JWT, so we know exactly who is joining without correlating Meet's
 * anonymous-guest participants back to our users. The Phase-4 conferenceRecords.participants
 * poll is duration-enrichment / fallback only. Mirrors {@code ZoomAttendanceService.markPresent}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleAttendanceService {

    private final LiveSessionLogsRepository liveSessionLogsRepository;

    /**
     * Marks a user PRESENT for a schedule (idempotent — updates the existing record on a
     * repeat join rather than inserting a duplicate).
     */
    public void markPresent(String sessionId, String scheduleId, String userId,
                            String fullName, String providerMeetingId) {
        if (scheduleId == null || userId == null) return;

        Optional<LiveSessionLogs> existing =
                liveSessionLogsRepository.findExistingAttendanceRecord(scheduleId, userId);
        String joinTimeIso = Instant.now().toString();
        Timestamp now = new Timestamp(System.currentTimeMillis());

        if (existing.isPresent()) {
            LiveSessionLogs logRow = existing.get();
            logRow.setProviderJoinTime(joinTimeIso);
            logRow.setProviderMeetingId(providerMeetingId);
            logRow.setStatus("PRESENT");
            logRow.setStatusType("ONLINE");
            logRow.setUpdatedAt(now);
            liveSessionLogsRepository.save(logRow);
        } else {
            LiveSessionLogs entry = LiveSessionLogs.builder()
                    .sessionId(sessionId)
                    .scheduleId(scheduleId)
                    .userSourceType("USER")
                    .userSourceId(userId)
                    .logType(SessionLog.ATTENDANCE_RECORDED.name())
                    .status("PRESENT")
                    .statusType("ONLINE")
                    .details((fullName != null ? fullName : "") + " | provider=GOOGLE_MEET")
                    .providerJoinTime(joinTimeIso)
                    .providerMeetingId(providerMeetingId)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            liveSessionLogsRepository.save(entry);
        }
    }
}
