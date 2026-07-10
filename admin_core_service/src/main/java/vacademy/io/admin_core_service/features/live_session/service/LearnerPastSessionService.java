package vacademy.io.admin_core_service.features.live_session.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.live_session.dto.LearnerDisplaySettingsFlags;
import vacademy.io.admin_core_service.features.live_session.dto.LearnerPastSessionDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LearnerPastSessionsResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LearnerRecordingDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSessionLogs;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionLogsRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Orchestrates the learner "Past Sessions" endpoint:
 * resolve institute -> read learnerDisplay flags -> (gate) -> paged past-session
 * query -> batched attendance/engagement enrichment -> per-flag sanitized DTOs.
 *
 * See docs/LIVE_CLASS_PAST_SESSIONS_AND_CONTENT_LINKING_PLAN.md sections A2/A3.
 * No caching for now — recordings land asynchronously and a stale "no
 * recording yet" response is a support headache; revisit once the FE refetch
 * cadence for the Past tab is settled.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerPastSessionService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final List<String> ACTIVE_ENROLLMENT_STATUSES = List.of("ACTIVE");

    private final LiveSessionRepository liveSessionRepository;
    private final LiveSessionLogsRepository liveSessionLogsRepository;
    private final LiveSessionLearnerDisplaySettingsService displaySettingsService;
    private final PackageSessionRepository packageSessionRepository;
    private final StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;
    private final ObjectMapper objectMapper;

    public LearnerPastSessionsResponseDTO getPastSessions(String batchId, String userId, String instituteId,
            int page, Integer size, String startDate, String endDate) {

        int pageSize = (size == null || size <= 0) ? DEFAULT_PAGE_SIZE : size;
        int pageNumber = Math.max(page, 0);

        String resolvedInstituteId = resolveInstituteId(batchId, userId, instituteId);
        LearnerDisplaySettingsFlags flags = displaySettingsService.getFlags(resolvedInstituteId);
        LearnerPastSessionsResponseDTO.DisplayFlagsDTO flagsDTO = LearnerPastSessionsResponseDTO.DisplayFlagsDTO
                .from(flags);

        if (!flags.showPastSessions()) {
            // Master switch off: never touch the sessions query — no data cost,
            // no URL-guessing leak, per plan A1/A2.
            return LearnerPastSessionsResponseDTO.empty(flagsDTO, pageNumber, pageSize);
        }

        Pageable pageable = PageRequest.of(pageNumber, pageSize);
        Page<LiveSessionRepository.LearnerPastSessionProjection> pageResult = liveSessionRepository
                .findPastSessionsForUserAndBatch(batchId, userId, startDate, endDate, pageable);

        List<LiveSessionRepository.LearnerPastSessionProjection> projections = pageResult.getContent();

        Map<String, List<LiveSessionLogs>> logsByScheduleId = Collections.emptyMap();
        if ((flags.showAttendance() || flags.showActivityStats()) && StringUtils.hasText(userId)
                && !projections.isEmpty()) {
            List<String> scheduleIds = projections.stream()
                    .map(LiveSessionRepository.LearnerPastSessionProjection::getScheduleId)
                    .distinct()
                    .collect(Collectors.toList());
            List<LiveSessionLogs> logs = liveSessionLogsRepository
                    .findAttendanceLogsForScheduleIdsAndUser(scheduleIds, userId);
            logsByScheduleId = logs.stream().collect(Collectors.groupingBy(LiveSessionLogs::getScheduleId));
        }

        List<LearnerPastSessionDTO> content = new ArrayList<>();
        for (LiveSessionRepository.LearnerPastSessionProjection projection : projections) {
            content.add(buildDto(projection, flags, logsByScheduleId));
        }

        return LearnerPastSessionsResponseDTO.builder()
                .displayFlags(flagsDTO)
                .content(content)
                .page(pageResult.getNumber())
                .size(pageResult.getSize())
                .totalPages(pageResult.getTotalPages())
                .totalElements(pageResult.getTotalElements())
                .last(pageResult.isLast())
                .build();
    }

    /**
     * instituteId param (explicit override, mirroring LearnerAttendanceReportController's
     * precedent) takes priority, then batchId -> package_session's owning institute,
     * then userId -> the learner's active enrollment institute. Returns null (never
     * throws) when none resolve — the settings lookup treats null as "flags off".
     */
    private String resolveInstituteId(String batchId, String userId, String instituteId) {
        if (StringUtils.hasText(instituteId)) {
            return instituteId;
        }
        if (StringUtils.hasText(batchId)) {
            Optional<String> resolved = packageSessionRepository.findInstituteIdByPackageSessionId(batchId);
            if (resolved.isPresent()) {
                return resolved.get();
            }
        }
        if (StringUtils.hasText(userId)) {
            Optional<String> resolved = studentSessionInstituteGroupMappingRepository
                    .findInstituteIdByUserIdAndStatus(userId, ACTIVE_ENROLLMENT_STATUSES);
            if (resolved.isPresent()) {
                return resolved.get();
            }
        }
        return null;
    }

    private LearnerPastSessionDTO buildDto(LiveSessionRepository.LearnerPastSessionProjection projection,
            LearnerDisplaySettingsFlags flags, Map<String, List<LiveSessionLogs>> logsByScheduleId) {

        LearnerPastSessionDTO.LearnerPastSessionDTOBuilder builder = LearnerPastSessionDTO.builder()
                .sessionId(projection.getSessionId())
                .scheduleId(projection.getScheduleId())
                .title(projection.getTitle())
                .subject(projection.getSubject())
                .meetingDate(projection.getMeetingDate())
                .startTime(projection.getStartTime())
                .lastEntryTime(projection.getLastEntryTime())
                .timezone(projection.getTimezone())
                .linkType(projection.getLinkType())
                .thumbnailFileId(projection.getThumbnailFileId());

        if (flags.showRecordings()) {
            builder.recordings(sanitizeRecordings(projection.getProviderRecordingsJson()));
        }

        List<LiveSessionLogs> logs = logsByScheduleId.get(projection.getScheduleId());

        if (flags.showAttendance()) {
            builder.attendanceStatus(resolveAttendanceStatus(logs));
        }

        if (flags.showActivityStats()) {
            builder.activity(resolveActivity(logs));
        }

        return builder.build();
    }

    private String resolveAttendanceStatus(List<LiveSessionLogs> logs) {
        if (logs == null || logs.isEmpty()) {
            return "UNMARKED";
        }
        // Most recent record wins (admin can re-mark attendance).
        LiveSessionLogs latest = logs.get(logs.size() - 1);
        String status = latest.getStatus();
        if (!StringUtils.hasText(status)) {
            return "UNMARKED";
        }
        return status.toUpperCase();
    }

    private LearnerPastSessionDTO.ActivityDTO resolveActivity(List<LiveSessionLogs> logs) {
        if (logs == null || logs.isEmpty()) {
            return LearnerPastSessionDTO.ActivityDTO.builder().build();
        }
        LiveSessionLogs latest = logs.get(logs.size() - 1);

        LearnerPastSessionDTO.ActivityDTO.ActivityDTOBuilder builder = LearnerPastSessionDTO.ActivityDTO.builder()
                .durationMinutes(latest.getProviderTotalDurationMinutes());

        if (StringUtils.hasText(latest.getEngagementData())) {
            try {
                Map<String, Object> engagement = objectMapper.readValue(latest.getEngagementData(),
                        new TypeReference<Map<String, Object>>() {
                        });
                builder.chats(asInteger(engagement.get("chats")));
                builder.talks(asInteger(engagement.get("talks")));
                builder.talkTime(asInteger(engagement.get("talkTime")));
                builder.raiseHand(asInteger(engagement.get("raisehand")));
                builder.emojis(asInteger(engagement.get("emojis")));
                builder.pollVotes(asInteger(engagement.get("pollVotes")));
            } catch (Exception e) {
                log.warn("Failed to parse engagement_data for log {}: {}", latest.getId(), e.getMessage());
            }
        }

        return builder.build();
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Maps raw provider_recordings_json (List<MeetingRecordingDTO>) to
     * sanitized LearnerRecordingDTOs. Per-recording playback type selection
     * priority: fileId (S3) > youtubeVideoUrl (YOUTUBE) > ZOOM_CLOUD playbackUrl
     * > any other playbackUrl (BBB). Never carries downloadUrl or provider host
     * URLs. See plan section A3.
     */
    private List<LearnerRecordingDTO> sanitizeRecordings(String providerRecordingsJson) {
        if (!StringUtils.hasText(providerRecordingsJson)) {
            return Collections.emptyList();
        }
        List<MeetingRecordingDTO> raw;
        try {
            raw = objectMapper.readValue(providerRecordingsJson, new TypeReference<List<MeetingRecordingDTO>>() {
            });
        } catch (Exception e) {
            log.warn("Failed to parse provider_recordings_json: {}", e.getMessage());
            return Collections.emptyList();
        }
        if (raw == null || raw.isEmpty()) {
            return Collections.emptyList();
        }

        List<LearnerRecordingDTO> sanitized = new ArrayList<>();
        for (MeetingRecordingDTO recording : raw) {
            LearnerRecordingDTO dto = sanitizeOneRecording(recording);
            if (dto != null) {
                sanitized.add(dto);
            }
        }
        return sanitized;
    }

    private LearnerRecordingDTO sanitizeOneRecording(MeetingRecordingDTO recording) {
        if (recording == null) {
            return null;
        }
        LearnerRecordingDTO.LearnerRecordingDTOBuilder builder = LearnerRecordingDTO.builder()
                .recordingId(recording.getRecordingId())
                .durationSeconds(recording.getDurationSeconds())
                .partLabel(recording.getType());

        if (StringUtils.hasText(recording.getFileId())) {
            return builder.playbackType("S3").fileId(recording.getFileId()).build();
        }

        if (StringUtils.hasText(recording.getYoutubeVideoUrl())) {
            return builder.playbackType("YOUTUBE").url(recording.getYoutubeVideoUrl()).build();
        }

        if ("ZOOM_CLOUD".equals(recording.getRecordingStorage()) && StringUtils.hasText(recording.getPlaybackUrl())) {
            builder.playbackType("ZOOM_CLOUD");
            if (isExpired(recording.getExpiresAt())) {
                // Omit url/passcode once expired — never hand out a dead/soon-invalid
                // provider link, just flag it so the FE can show "Recording expired".
                return builder.expired(true).build();
            }
            return builder
                    .url(recording.getPlaybackUrl())
                    .passcode(recording.getPasscode())
                    .expiresAt(recording.getExpiresAt())
                    .expired(false)
                    .build();
        }

        if (StringUtils.hasText(recording.getPlaybackUrl())) {
            return builder.playbackType("BBB").url(recording.getPlaybackUrl()).build();
        }

        // No usable playback source — omit this recording entirely; the FE's
        // "Recording not available" card is driven by an empty recordings list.
        return null;
    }

    private boolean isExpired(String expiresAtIso) {
        if (!StringUtils.hasText(expiresAtIso)) {
            return false;
        }
        try {
            return Instant.parse(expiresAtIso).isBefore(Instant.now());
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
