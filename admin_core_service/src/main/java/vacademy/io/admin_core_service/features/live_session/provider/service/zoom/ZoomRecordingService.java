package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.manager.ZoomMeetingManager;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.live_session.service.RecordingAutoLinkService;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fetches Zoom cloud recordings for a schedule and persists them onto
 * session_schedules.provider_recordings_json. Single source of truth shared by the
 * webhook (recording.completed) and the hourly polling fallback.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomRecordingService {

    /** Zoom's default cloud-recording retention before auto-deletion. */
    private static final int DEFAULT_RETENTION_DAYS = 30;

    private final ZoomMeetingManager zoomMeetingManager;
    private final ZoomAccountStore zoomAccountStore;
    private final SessionScheduleRepository scheduleRepository;
    private final ObjectMapper objectMapper;
    private final RecordingAutoLinkService recordingAutoLinkService;

    /**
     * Pulls recordings from the Zoom API for a schedule and merges them into the
     * stored list. Idempotent — re-running won't duplicate recordings. Returns the
     * number of newly added recordings.
     */
    @Transactional
    public int syncFromApi(SessionSchedule schedule) {
        if (schedule.getProviderAccountId() == null || schedule.getProviderMeetingId() == null) {
            return 0;
        }
        ZoomAccount account = zoomAccountStore.findById(schedule.getProviderAccountId())
                .orElse(null);
        if (account == null) {
            log.warn("zoom.recording.sync skipped — account {} missing for schedule {}",
                    schedule.getProviderAccountId(), schedule.getId());
            return 0;
        }

        List<MeetingRecordingDTO> fetched =
                zoomMeetingManager.fetchRecordings(account, schedule.getProviderMeetingId());

        int added = persist(schedule, fetched);
        schedule.setLastRecordingSyncAt(new Date());
        scheduleRepository.save(schedule);
        recordingAutoLinkService.processSchedule(schedule);
        return added;
    }

    /**
     * Merges new recordings into the schedule's stored JSON (dedupe by recordingId),
     * keeps recordingStorage = ZOOM if unset, and sets an approximate expiry so the
     * admin UI can warn before Zoom auto-deletes.
     */
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
        String defaultExpiresAt = defaultExpiryIso();
        for (MeetingRecordingDTO rec : fetched) {
            if (rec.getRecordingId() == null) continue;
            if (!byId.containsKey(rec.getRecordingId())) {
                added++;
            }
            // Per-recording expiry — Zoom auto-deletes cloud recordings after
            // ~30 days. Only set when the recording hasn't been mirrored to S3
            // (fileId present → recording lives on S3 now, no provider expiry).
            if (rec.getFileId() == null && rec.getExpiresAt() == null) {
                rec.setExpiresAt(defaultExpiresAt);
            }
            // Tag storage so the admin UI can show a "Zoom Cloud (expires in N days)"
            // vs "Library/S3" badge. The S3 mirror flips this to "S3" once uploaded.
            if (rec.getRecordingStorage() == null) {
                rec.setRecordingStorage(rec.getFileId() != null ? "S3" : "ZOOM_CLOUD");
            }
            // Always upsert latest URLs/metadata (download tokens rotate).
            byId.put(rec.getRecordingId(), rec);
        }

        try {
            schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(new ArrayList<>(byId.values())));
        } catch (Exception e) {
            log.error("zoom.recording.persist serialize failed for schedule {}: {}",
                    schedule.getId(), e.getMessage());
            return 0;
        }

        log.info("zoom.recording.persist scheduleId={} added={} total={}",
                schedule.getId(), added, byId.size());
        return added;
    }

    /** Public read of the stored recordings (used by the S3 mirror service). */
    public List<MeetingRecordingDTO> getStoredRecordings(SessionSchedule schedule) {
        return parseExisting(schedule);
    }

    /** Serializes and saves the recordings list back onto the schedule. */
    @Transactional
    public void replaceRecordings(SessionSchedule schedule, List<MeetingRecordingDTO> recordings) {
        try {
            schedule.setProviderRecordingsJson(objectMapper.writeValueAsString(recordings));
            scheduleRepository.save(schedule);
            recordingAutoLinkService.processSchedule(schedule);
        } catch (Exception e) {
            log.error("zoom.recording.replace serialize failed for schedule {}: {}",
                    schedule.getId(), e.getMessage());
        }
    }

    private List<MeetingRecordingDTO> parseExisting(SessionSchedule schedule) {
        if (schedule.getProviderRecordingsJson() == null
                || schedule.getProviderRecordingsJson().isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(schedule.getProviderRecordingsJson(),
                    new TypeReference<List<MeetingRecordingDTO>>() {});
        } catch (Exception e) {
            log.warn("zoom.recording.persist could not parse existing JSON for schedule {}",
                    schedule.getId());
            return new ArrayList<>();
        }
    }

    /** Approximate ISO-8601 expiry — Zoom's default cloud retention is 30 days. */
    private static String defaultExpiryIso() {
        return Instant.now().plus(DEFAULT_RETENTION_DAYS, ChronoUnit.DAYS).toString();
    }
}
