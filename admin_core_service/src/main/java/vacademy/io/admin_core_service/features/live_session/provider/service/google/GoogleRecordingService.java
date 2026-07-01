package vacademy.io.admin_core_service.features.live_session.provider.service.google;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.google.GoogleAccount;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fetches Google Meet recordings (via {@link GoogleConferenceService}) for a schedule and
 * persists them onto {@code session_schedules.provider_recordings_json}. Source of truth for the
 * recording polling job and (later) the Events-API webhook. Mirrors {@code ZoomRecordingService}.
 *
 * Unlike Zoom, Meet recordings live in the organizer's Drive and do NOT auto-delete, so no
 * {@code expiresAt} is set; storage is tagged {@code GOOGLE_DRIVE}. The MP4 itself is fetched
 * via {@code driveDestination.exportUri} (admin-facing in v1 — no S3 mirror, which would need the
 * restricted Drive scope + CASA).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleRecordingService {

    private final GoogleConferenceService conferenceService;
    private final GoogleAccountStore googleAccountStore;
    private final SessionScheduleRepository scheduleRepository;
    private final ObjectMapper objectMapper;

    /**
     * Pulls recordings from the Meet REST API for a schedule and merges them into the stored list.
     * Idempotent (dedupe by recordingId). Returns the number of newly added recordings.
     */
    @Transactional
    public int syncFromApi(SessionSchedule schedule) {
        if (schedule.getProviderAccountId() == null || schedule.getProviderMeetingId() == null) {
            return 0;
        }
        GoogleAccount account = googleAccountStore.findById(schedule.getProviderAccountId()).orElse(null);
        if (account == null) {
            log.warn("google.recording.sync skipped — account {} missing for schedule {}",
                    schedule.getProviderAccountId(), schedule.getId());
            return 0;
        }

        List<MeetingRecordingDTO> fetched =
                conferenceService.fetchRecordings(account, schedule.getProviderMeetingId());

        int added = persist(schedule, fetched);
        schedule.setLastRecordingSyncAt(new Date());
        scheduleRepository.save(schedule);
        return added;
    }

    private int persist(SessionSchedule schedule, List<MeetingRecordingDTO> fetched) {
        if (fetched == null || fetched.isEmpty()) {
            return 0;
        }
        Map<String, MeetingRecordingDTO> byId = new LinkedHashMap<>();
        for (MeetingRecordingDTO existing : parseExisting(schedule)) {
            if (existing.getRecordingId() != null) {
                byId.put(existing.getRecordingId(), existing);
            }
        }
        int added = 0;
        for (MeetingRecordingDTO rec : fetched) {
            if (rec.getRecordingId() == null) continue;
            if (!byId.containsKey(rec.getRecordingId())) {
                added++;
            }
            if (rec.getRecordingStorage() == null) {
                rec.setRecordingStorage("GOOGLE_DRIVE");
            }
            byId.put(rec.getRecordingId(), rec); // upsert latest URLs/metadata
        }

        try {
            schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(new ArrayList<>(byId.values())));
        } catch (Exception e) {
            log.error("google.recording.persist serialize failed for schedule {}: {}",
                    schedule.getId(), e.getMessage());
            return 0;
        }
        log.info("google.recording.persist scheduleId={} added={} total={}",
                schedule.getId(), added, byId.size());
        return added;
    }

    /** Recordings currently stored on the schedule (no API call). */
    public List<MeetingRecordingDTO> getStored(SessionSchedule schedule) {
        return parseExisting(schedule);
    }

    private List<MeetingRecordingDTO> parseExisting(SessionSchedule schedule) {
        if (schedule.getProviderRecordingsJson() == null || schedule.getProviderRecordingsJson().isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(schedule.getProviderRecordingsJson(),
                    new TypeReference<List<MeetingRecordingDTO>>() {});
        } catch (Exception e) {
            log.warn("google.recording.persist could not parse existing JSON for schedule {}",
                    schedule.getId());
            return new ArrayList<>();
        }
    }
}
