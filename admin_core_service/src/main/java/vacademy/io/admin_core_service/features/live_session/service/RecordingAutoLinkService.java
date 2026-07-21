package vacademy.io.admin_core_service.features.live_session.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.live_session.dto.ContentLinkDestinationDTO;
import vacademy.io.admin_core_service.features.live_session.dto.ContentLinkOutcomeDTO;
import vacademy.io.admin_core_service.features.live_session.dto.ContentLinkSourceDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LinkContentRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.RecordingAutoLinkConfigDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Auto-links newly-synced recordings of a session occurrence into the course
 * chapters the admin configured at Step 2 ({@code recording_auto_link_json}
 * on {@link LiveSession}). Reuses {@link LiveSessionContentLinkService} —
 * same slide creation and (schedule_id, recording_id, chapter_id) idempotency
 * as the manual content-link flow, so calling this on every recording sync is
 * safe (ALREADY_LINKED outcomes are expected, not errors).
 *
 * Must never break the caller's sync flow: every failure is caught and
 * logged, never rethrown. See docs/LIVE_SESSION_RECORDING_AUTO_LINK_PLAN.md.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecordingAutoLinkService {

    private static final String LIVE_SESSION_SETTING_KEY = "LIVE_SESSION_SETTING";

    private final LiveSessionRepository liveSessionRepository;
    private final LiveSessionContentLinkService liveSessionContentLinkService;
    private final InstituteSettingService instituteSettingService;
    private final ObjectMapper objectMapper;

    /**
     * Entry point called after a provider recording sync persists
     * {@code providerRecordingsJson} onto the schedule. Bails out quickly
     * (no-op) when the session has no auto-link config, it's disabled, or
     * there are no destinations — the common case for most sessions.
     */
    public void processSchedule(SessionSchedule schedule) {
        try {
            if (schedule == null || !StringUtils.hasText(schedule.getSessionId())) {
                return;
            }
            LiveSession session = liveSessionRepository.findById(schedule.getSessionId()).orElse(null);
            if (session == null) {
                return;
            }
            RecordingAutoLinkConfigDTO config = resolveConfig(session);
            if (config == null || !Boolean.TRUE.equals(config.getEnabled())) {
                return;
            }
            if (config.getDestinations() == null || config.getDestinations().isEmpty()) {
                return;
            }

            List<MeetingRecordingDTO> recordings = parseRecordings(schedule.getProviderRecordingsJson());
            if (recordings.isEmpty()) {
                return;
            }

            for (MeetingRecordingDTO recording : selectPreferredRecordings(recordings, schedule)) {
                processRecording(session, schedule, config, recording);
            }
        } catch (Exception e) {
            // Recording sync (webhook / cron) must never fail because auto-linking
            // blew up — log and move on.
            log.warn("recording_auto_link.process_schedule failed scheduleId={}: {}",
                    schedule != null ? schedule.getId() : null, e.getMessage(), e);
        }
    }

    /**
     * A class typically yields multiple recording files for the same occurrence —
     * e.g. Zoom uploads a presenter/screen-share view AND a webcam-only view
     * (plus an audio-only M4A), BBB splits "content" and "webcams". Only the
     * presenter view is auto-uploaded: webcam-only and audio-only files are
     * always ignored. When Zoom produces both a combined screen+speaker view and
     * a plain screen-share view, only the best tier is kept so the chapter gets
     * one slide per recorded segment (multiple same-tier files = the teacher
     * stopped/restarted recording; all are kept, ordered by start time).
     */
    private List<MeetingRecordingDTO> selectPreferredRecordings(List<MeetingRecordingDTO> recordings,
            SessionSchedule schedule) {
        int bestTier = Integer.MAX_VALUE;
        for (MeetingRecordingDTO recording : recordings) {
            bestTier = Math.min(bestTier, viewTier(recording));
        }
        if (bestTier == Integer.MAX_VALUE) {
            return List.of();
        }
        List<MeetingRecordingDTO> selected = new ArrayList<>();
        for (MeetingRecordingDTO recording : recordings) {
            if (viewTier(recording) == bestTier) {
                selected.add(recording);
            } else {
                log.info("recording_auto_link.skip_secondary_view scheduleId={} recordingId={} type={}",
                        schedule.getId(), recording.getRecordingId(), recording.getType());
            }
        }
        selected.sort(Comparator.comparing(r -> r.getStartTime() == null ? "" : r.getStartTime()));
        return selected;
    }

    /** Lower is better. Integer.MAX_VALUE = never auto-link (webcam-only and audio-only views). */
    private int viewTier(MeetingRecordingDTO recording) {
        if (recording == null || !StringUtils.hasText(recording.getRecordingId())) {
            return Integer.MAX_VALUE;
        }
        String type = recording.getType() == null ? "" : recording.getType().toLowerCase();
        if (type.contains("audio_only")) {
            return Integer.MAX_VALUE;
        }
        // Webcam-only views are never auto-uploaded.
        // Zoom: active_speaker / gallery_view / speaker_view; BBB: webcams
        if (type.contains("speaker") || type.contains("gallery") || type.equals("webcams")) {
            // shared_screen_with_speaker_view also contains "speaker" — that one is
            // a presenter view, so only skip when it's NOT a screen share.
            if (!type.contains("shared_screen")) {
                return Integer.MAX_VALUE;
            }
        }
        // Zoom: shared_screen_with_speaker_view / shared_screen_with_gallery_view; BBB legacy: full
        if ((type.contains("shared_screen") && type.contains("with")) || type.equals("full")) {
            return 0;
        }
        // Zoom: shared_screen; BBB: content (screen share / camera-as-content);
        // unknown/blank type (legacy rows, other providers) also lands here so a
        // single-file recording without type metadata still auto-uploads.
        return 1;
    }

    private void processRecording(LiveSession session, SessionSchedule schedule, RecordingAutoLinkConfigDTO config,
            MeetingRecordingDTO recording) {
        if (recording == null || !StringUtils.hasText(recording.getRecordingId())) {
            return;
        }
        boolean linkable = StringUtils.hasText(recording.getFileId()) || StringUtils.hasText(recording.getYoutubeVideoUrl());
        if (!linkable) {
            // Provider playback URL only (expiring Zoom/BBB link) — the content-link
            // service refuses these. The S3 mirror will rewrite the recording with a
            // fileId and re-trigger this hook, at which point it becomes linkable.
            log.info("recording_auto_link.skip_not_mirrored scheduleId={} recordingId={}",
                    schedule.getId(), recording.getRecordingId());
            return;
        }

        try {
            LinkContentRequestDTO request = buildRequest(session, schedule, config, recording);
            List<ContentLinkOutcomeDTO> outcomes = liveSessionContentLinkService.linkContent(request,
                    session.getCreatedByUserId());
            for (ContentLinkOutcomeDTO outcome : outcomes) {
                log.info("recording_auto_link.outcome scheduleId={} recordingId={} chapterId={} outcome={}",
                        schedule.getId(), recording.getRecordingId(), outcome.getChapterId(), outcome.getOutcome());
            }
        } catch (Exception e) {
            log.warn("recording_auto_link.link_failed scheduleId={} recordingId={}: {}",
                    schedule.getId(), recording.getRecordingId(), e.getMessage(), e);
        }
    }

    private LinkContentRequestDTO buildRequest(LiveSession session, SessionSchedule schedule,
            RecordingAutoLinkConfigDTO config, MeetingRecordingDTO recording) {
        ContentLinkSourceDTO source = new ContentLinkSourceDTO();
        source.setKind("RECORDING");
        source.setRecordingId(recording.getRecordingId());

        LinkContentRequestDTO request = new LinkContentRequestDTO();
        request.setSessionId(session.getId());
        request.setScheduleId(schedule.getId());
        request.setSource(source);
        request.setTitle(buildTitle(session, schedule));
        request.setSlideStatus(StringUtils.hasText(config.getSlideStatus()) ? config.getSlideStatus()
                : SlideStatus.PUBLISHED.name());
        request.setNotify(Boolean.TRUE.equals(config.getNotify()));
        request.setPosition("BOTTOM");
        request.setDestinations(config.getDestinations());
        return request;
    }

    private String buildTitle(LiveSession session, SessionSchedule schedule) {
        String base = StringUtils.hasText(session.getTitle()) ? session.getTitle() : "Live Class";
        String datePart = "";
        if (schedule.getMeetingDate() != null) {
            try {
                datePart = " — " + new SimpleDateFormat("yyyy-MM-dd").format(schedule.getMeetingDate());
            } catch (Exception ignored) {
                // fall through with no date suffix
            }
        }
        return base + datePart + " Recording";
    }

    /**
     * Fallback semantics (see docs/LIVE_SESSION_RECORDING_AUTO_LINK_PLAN.md
     * Phase 2):
     * <ul>
     * <li>session config present &amp; enabled -&gt; use it as-is;</li>
     * <li>session config present &amp; disabled -&gt; explicit opt-out wins,
     * return the disabled config so the caller no-ops;</li>
     * <li>session config absent -&gt; fall back to the institute-level
     * {@code LIVE_SESSION_SETTING.lmsConnection} default destination, if
     * configured.</li>
     * </ul>
     */
    private RecordingAutoLinkConfigDTO resolveConfig(LiveSession session) {
        RecordingAutoLinkConfigDTO sessionConfig = parseConfig(session.getRecordingAutoLinkJson());
        if (sessionConfig != null) {
            return sessionConfig;
        }
        return resolveInstituteDefaultConfig(session.getInstituteId());
    }

    private RecordingAutoLinkConfigDTO resolveInstituteDefaultConfig(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return null;
        }
        try {
            Object rawData = instituteSettingService.getSettingByInstituteIdAndKey(instituteId,
                    LIVE_SESSION_SETTING_KEY);
            if (rawData == null) {
                return null;
            }

            JsonNode root = objectMapper.valueToTree(rawData);
            JsonNode lmsConnection = root.path("lmsConnection");
            if (lmsConnection.isMissingNode() || !lmsConnection.isObject()) {
                return null;
            }

            boolean autoUploadEnabled = lmsConnection.path("autoUploadRecordingsEnabled").asBoolean(false);
            if (!autoUploadEnabled) {
                return null;
            }

            JsonNode destinationNode = lmsConnection.path("autoUploadDefaultDestination");
            if (destinationNode.isMissingNode() || !destinationNode.isObject()) {
                return null;
            }

            String chapterId = destinationNode.path("chapterId").asText(null);
            String packageSessionId = destinationNode.path("packageSessionId").asText(null);
            if (!StringUtils.hasText(chapterId) || !StringUtils.hasText(packageSessionId)) {
                return null;
            }

            ContentLinkDestinationDTO destination = new ContentLinkDestinationDTO();
            destination.setPackageSessionId(packageSessionId);
            destination.setChapterId(chapterId);
            String subjectId = destinationNode.path("subjectId").asText(null);
            if (StringUtils.hasText(subjectId)) {
                destination.setSubjectId(subjectId);
            }
            String moduleId = destinationNode.path("moduleId").asText(null);
            if (StringUtils.hasText(moduleId)) {
                destination.setModuleId(moduleId);
            }

            RecordingAutoLinkConfigDTO config = new RecordingAutoLinkConfigDTO();
            config.setEnabled(true);
            config.setSlideStatus(SlideStatus.PUBLISHED.name());
            config.setNotify(lmsConnection.path("autoUploadNotifyLearners").asBoolean(false));
            config.setDestinations(Collections.singletonList(destination));
            return config;
        } catch (Exception e) {
            log.warn("recording_auto_link.institute_default_read_failed instituteId={}: {}", instituteId,
                    e.getMessage());
            return null;
        }
    }

    private RecordingAutoLinkConfigDTO parseConfig(String json) {
        if (!StringUtils.hasText(json)) {
            return null;
        }
        try {
            return objectMapper.readValue(json, RecordingAutoLinkConfigDTO.class);
        } catch (Exception e) {
            log.warn("recording_auto_link.config_parse_failed: {}", e.getMessage());
            return null;
        }
    }

    private List<MeetingRecordingDTO> parseRecordings(String json) {
        if (!StringUtils.hasText(json)) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<MeetingRecordingDTO>>() {
            });
        } catch (Exception e) {
            log.warn("recording_auto_link.recordings_parse_failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
