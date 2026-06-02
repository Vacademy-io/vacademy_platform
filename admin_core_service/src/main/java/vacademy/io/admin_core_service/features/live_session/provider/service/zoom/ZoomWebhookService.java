package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;

import java.util.Date;
import java.util.List;

/**
 * Dispatches verified Zoom webhook events to the right handler.
 *
 * Handled events:
 *  - recording.completed → pull + persist cloud recordings
 *  - meeting.ended       → stamp last sync time (recordings aren't ready yet here)
 *  - participant joined/left → no-op for now; attendance is captured reliably at
 *    join time (see {@link ZoomAttendanceService}). Correlating Zoom's webhook
 *    participant ids back to our users needs the SDK customerKey wiring — deferred.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomWebhookService {

    private final SessionScheduleRepository scheduleRepository;
    private final ZoomRecordingService zoomRecordingService;

    public void handle(String event, JsonNode root, ZoomAccount account) {
        String meetingId = root.path("payload").path("object").path("id").asText(null);

        switch (event) {
            case "recording.completed" -> handleRecordingCompleted(meetingId, account);
            case "meeting.ended" -> handleMeetingEnded(meetingId);
            case "meeting.participant_joined", "meeting.participant_left" ->
                    log.debug("zoom.webhook participant event {} meetingId={} (no-op)", event, meetingId);
            default -> log.debug("zoom.webhook unhandled event {} meetingId={}", event, meetingId);
        }
    }

    private void handleRecordingCompleted(String meetingId, ZoomAccount account) {
        if (meetingId == null) return;
        List<SessionSchedule> schedules = scheduleRepository.findByProviderMeetingId(meetingId);
        if (schedules.isEmpty()) {
            log.warn("zoom.webhook recording.completed — no schedule for meetingId={}", meetingId);
            return;
        }
        for (SessionSchedule schedule : schedules) {
            try {
                int added = zoomRecordingService.syncFromApi(schedule);
                log.info("zoom.webhook recording.completed scheduleId={} added={}",
                        schedule.getId(), added);
            } catch (Exception e) {
                log.error("zoom.webhook recording.completed failed scheduleId={}: {}",
                        schedule.getId(), e.getMessage());
            }
        }
    }

    private void handleMeetingEnded(String meetingId) {
        if (meetingId == null) return;
        for (SessionSchedule schedule : scheduleRepository.findByProviderMeetingId(meetingId)) {
            schedule.setLastAttendanceSyncAt(new Date());
            scheduleRepository.save(schedule);
        }
    }
}
