package vacademy.io.admin_core_service.features.live_session.provider.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderMeetingCreateRequestDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * Creates a provider meeting for EVERY schedule row of a session, server-side.
 *
 * Recurring sessions fan out into N {@link SessionSchedule} rows
 * ({@code Step1Service.handleAddedSchedules}). Previously the admin browser
 * looped a create-meeting call per row, which is fragile (the tab must stay open
 * for the whole loop) and creates meetings inconsistently if it's interrupted.
 *
 * This moves the loop onto the server: one HTTP call provisions the whole series
 * in the background, deriving each occurrence's start time + duration from its own
 * row. It is <b>idempotent</b> — rows that already have a {@code providerMeetingId}
 * are skipped — so a re-call safely fills only the gaps (the recovery path if the
 * async run is interrupted).
 *
 * Per-occurrence meetings (rather than one native recurring meeting) keep each
 * occurrence independently addressable: attendance and recordings disambiguate by
 * their own {@code providerMeetingId} with no occurrence-cap and no date-alignment
 * coupling to the provider's recurrence expansion.
 *
 * Lives in its own bean (not on {@link LiveSessionProviderService}) so the async
 * loop calls {@code createMeeting} through the Spring proxy — each occurrence gets
 * its own transaction and one failure doesn't roll back the others.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProviderMeetingBatchService {

    private final LiveSessionProviderService providerService;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionRepository liveSessionRepository;
    private final ObjectMapper objectMapper;

    /**
     * Persists the Zoom account + meeting settings chosen for a session so the
     * provisioning retry job can re-create meetings for any occurrence whose
     * up-front async provisioning was interrupted, without re-asking the UI.
     * Only stores when there's actually a provider account (Zoom flow).
     */
    public void rememberProvisioningConfig(ProviderMeetingCreateRequestDTO request) {
        if (request == null || request.getSessionId() == null
                || request.resolveProviderAccountId() == null) {
            return;
        }
        liveSessionRepository.findById(request.getSessionId()).ifPresent(session -> {
            try {
                session.setZoomAccountId(request.resolveProviderAccountId());
                Map<String, Object> cfg = request.resolveProviderConfig();
                session.setZoomConfigJson(cfg != null ? objectMapper.writeValueAsString(cfg) : null);
                liveSessionRepository.save(session);
            } catch (Exception e) {
                log.warn("provider.batch.remember_config_failed sessionId={}: {}",
                        request.getSessionId(), e.getMessage());
            }
        });
    }

    /**
     * Rebuilds a create request from a session's stored Zoom config and provisions
     * its still-pending occurrences. Used by the retry scheduler; idempotent via
     * {@link #createMeetingsForSession}. Returns the number created.
     */
    public int reprovisionFromStoredConfig(LiveSession session) {
        if (session == null || session.getZoomAccountId() == null || session.getZoomAccountId().isBlank()) {
            return 0;
        }
        Map<String, Object> cfg = null;
        if (session.getZoomConfigJson() != null && !session.getZoomConfigJson().isBlank()) {
            try {
                cfg = objectMapper.readValue(session.getZoomConfigJson(),
                        new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                log.warn("provider.batch.reprovision parse config failed sessionId={}: {}",
                        session.getId(), e.getMessage());
            }
        }
        ProviderMeetingCreateRequestDTO request = ProviderMeetingCreateRequestDTO.builder()
                .instituteId(session.getInstituteId())
                .sessionId(session.getId())
                .provider(MeetingProvider.ZOOM_MEETING.name())
                .topic(session.getTitle())
                .providerAccountId(session.getZoomAccountId())
                .providerConfig(cfg)
                .build();
        return createMeetingsForSession(request);
    }

    /** Count of schedules that still need a meeting (for an immediate response to the caller). */
    public int countPending(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return 0;
        }
        return (int) loadPending(sessionId).count();
    }

    /** Fire-and-forget wrapper so the HTTP request returns immediately for long series. */
    @Async
    public void createMeetingsForSessionAsync(ProviderMeetingCreateRequestDTO request) {
        try {
            createMeetingsForSession(request);
        } catch (Exception e) {
            log.error("provider.batch.create.async_failed sessionId={}: {}",
                    request != null ? request.getSessionId() : null, e.getMessage(), e);
        }
    }

    /**
     * Provisions a meeting for each not-yet-provisioned schedule of the session.
     * Returns the number created. Each occurrence is created in its own transaction;
     * a single failure is logged and the loop continues.
     */
    public int createMeetingsForSession(ProviderMeetingCreateRequestDTO request) {
        String sessionId = request.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return 0;
        }
        String timezone = resolveTimezone(sessionId, request.getTimezone());
        List<SessionSchedule> pending = loadPending(sessionId).toList();
        int created = 0;
        for (SessionSchedule schedule : pending) {
            try {
                ProviderMeetingCreateRequestDTO perOccurrence = ProviderMeetingCreateRequestDTO.builder()
                        .instituteId(request.getInstituteId())
                        .sessionId(sessionId)
                        .scheduleId(schedule.getId())
                        .provider(request.getProvider())
                        .topic(request.getTopic())
                        .agenda(request.getAgenda())
                        .timezone(timezone)
                        .providerConfig(request.getProviderConfig())
                        .providerAccountId(request.getProviderAccountId())
                        .zoomAccountId(request.getZoomAccountId())
                        .zoomConfig(request.getZoomConfig())
                        .bbbConfig(request.getBbbConfig())
                        .startTime(toIsoStartTime(schedule, timezone))
                        .durationMinutes(deriveDurationMinutes(schedule, request.getDurationMinutes()))
                        .build();
                providerService.createMeeting(perOccurrence);
                created++;
            } catch (Exception e) {
                log.error("provider.batch.create.fail sessionId={} scheduleId={} provider={}: {}",
                        sessionId, schedule.getId(), request.getProvider(), e.getMessage());
            }
        }
        log.info("provider.batch.create sessionId={} provider={} pending={} created={}",
                sessionId, request.getProvider(), pending.size(), created);
        return created;
    }

    private Stream<SessionSchedule> loadPending(String sessionId) {
        return scheduleRepository.findBySessionId(sessionId).stream()
                .filter(s -> !"DELETED".equalsIgnoreCase(s.getStatus()))
                .filter(s -> s.getProviderMeetingId() == null || s.getProviderMeetingId().isBlank());
    }

    private String resolveTimezone(String sessionId, String fallback) {
        String tz = liveSessionRepository.findById(sessionId)
                .map(LiveSession::getTimezone)
                .orElse(null);
        if (tz != null && !tz.isBlank()) {
            return tz;
        }
        return (fallback != null && !fallback.isBlank()) ? fallback : "Asia/Kolkata";
    }

    /** Builds an ISO-8601 offset datetime from the row's meeting date + start time in the session timezone. */
    static String toIsoStartTime(SessionSchedule schedule, String timezone) {
        ZoneId zone = ZoneId.of(timezone);
        Date meetingDate = schedule.getMeetingDate();
        LocalDate localDate = (meetingDate instanceof java.sql.Date sqlDate)
                ? sqlDate.toLocalDate()
                : meetingDate.toInstant().atZone(zone).toLocalDate();
        LocalTime localTime = schedule.getStartTime() != null
                ? schedule.getStartTime().toLocalTime()
                : LocalTime.MIDNIGHT;
        return LocalDateTime.of(localDate, localTime).atZone(zone).toOffsetDateTime().toString();
    }

    /** Duration = start → last-entry window; falls back to the request value, then 60m. */
    static int deriveDurationMinutes(SessionSchedule schedule, int fallback) {
        if (schedule.getStartTime() != null && schedule.getLastEntryTime() != null) {
            long minutes = Duration.between(
                    schedule.getStartTime().toLocalTime(),
                    schedule.getLastEntryTime().toLocalTime()).toMinutes();
            if (minutes > 0) {
                return (int) minutes;
            }
        }
        return fallback > 0 ? fallback : 60;
    }
}
