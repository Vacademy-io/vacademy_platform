package vacademy.io.admin_core_service.features.live_session.provider.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.LiveSessionProviderFactory;
import vacademy.io.admin_core_service.features.live_session.provider.LiveSessionProviderStrategy;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderMeetingCreateRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO;
import vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig;
import vacademy.io.admin_core_service.features.live_session.provider.repository.LiveSessionProviderConfigRepository;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.meeting.dto.CreateMeetingRequestDTO;
import vacademy.io.common.meeting.dto.CreateMeetingResponseDTO;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;
import vacademy.io.common.meeting.enums.MeetingProvider;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orchestrates all live session provider operations.
 * Uses SessionSchedule directly — no separate provider-meeting table needed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LiveSessionProviderService {

    private final ObjectMapper objectMapper;
    private final LiveSessionProviderFactory providerFactory;
    private final LiveSessionProviderConfigRepository configRepository;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionRepository sessionRepository;

    private static final List<String> ACTIVE = List.of("ACTIVE");

    // -----------------------------------------------------------------------
    // OAuth connect
    // -----------------------------------------------------------------------

    public LiveSessionProviderConfig connectProvider(String providerName, ProviderConnectRequestDTO request) {
        String normalizedProvider = MeetingProvider.fromString(providerName).name();
        return providerFactory.getStrategy(normalizedProvider).connectProvider(request);
    }

    public boolean isProviderConnected(String instituteId, String providerName) {
        String normalizedProvider = MeetingProvider.fromString(providerName).name();
        return configRepository.existsByInstituteIdAndProviderAndStatusIn(instituteId, normalizedProvider, ACTIVE);
    }

    /** Returns config with secrets masked — safe for dashboard display */
    public Optional<Map<String, Object>> getProviderConfigDisplay(String instituteId, String provider) {
        return configRepository
                .findByInstituteIdAndProviderAndStatusIn(instituteId, provider, ACTIVE)
                .map(cfg -> {
                    try {
                        Map<String, Object> map = objectMapper.readValue(cfg.getConfigJson(),
                                new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
                                });
                        map.remove("clientSecret");
                        map.remove("accessToken");
                        map.remove("refreshToken");
                        return map;
                    } catch (Exception e) {
                        throw new VacademyException("Failed to read provider config");
                    }
                });
    }

    // -----------------------------------------------------------------------
    // Create meeting
    // -----------------------------------------------------------------------

    /**
     * Creates a provider meeting for a schedule.
     * Stores providerMeetingId, joinUrl and hostUrl directly on SessionSchedule.
     */
    @Transactional
    public CreateMeetingResponseDTO createMeeting(ProviderMeetingCreateRequestDTO request) {
        String providerName = resolveProviderName(request);
        LiveSessionProviderStrategy strategy = providerFactory.getStrategy(providerName);

        CreateMeetingRequestDTO meetingRequest = CreateMeetingRequestDTO.builder()
                .topic(request.getTopic())
                .agenda(request.getAgenda())
                .startTime(request.getStartTime())
                .durationMinutes(request.getDurationMinutes())
                .timezone(request.getTimezone())
                .hostEmail(request.getHostEmail())
                .sessionId(request.getSessionId())
                .scheduleId(request.getScheduleId())
                .build();

        CreateMeetingResponseDTO response = strategy.createMeeting(meetingRequest, request.getInstituteId());

        // Write everything back to the schedule row — no extra table needed
        if (request.getScheduleId() != null) {
            scheduleRepository.findById(request.getScheduleId()).ifPresent(schedule -> {
                schedule.setCustomMeetingLink(response.getJoinUrl()); // learner join URL
                schedule.setLinkType(providerName);
                schedule.setProviderMeetingId(response.getProviderMeetingId());
                schedule.setProviderHostUrl(response.getHostUrl());
                scheduleRepository.save(schedule);

                if (schedule.getSessionId() != null) {
                    sessionRepository.findById(schedule.getSessionId()).ifPresent(session -> {
                        session.setDefaultMeetLink(response.getJoinUrl());
                        session.setLinkType(providerName);
                        sessionRepository.save(session);
                    });
                }

                log.info("Schedule {} updated with meetingKey={} for provider={}", request.getScheduleId(),
                        response.getProviderMeetingId(), providerName);
            });
        }

        return response;
    }

    // -----------------------------------------------------------------------
    // Recordings & Attendance (on-demand)
    // -----------------------------------------------------------------------

    public List<MeetingRecordingDTO> getRecordings(String scheduleId, String instituteId) {
        SessionSchedule schedule = getScheduleOrThrow(scheduleId);
        return providerFactory.getStrategy(schedule.getLinkType())
                .getRecordings(schedule.getProviderMeetingId(), instituteId);
    }

    public List<MeetingAttendeeDTO> getAttendance(String scheduleId, String instituteId) {
        SessionSchedule schedule = getScheduleOrThrow(scheduleId);
        return providerFactory.getStrategy(schedule.getLinkType())
                .getAttendance(schedule.getProviderMeetingId(), instituteId);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private String resolveProviderName(ProviderMeetingCreateRequestDTO request) {
        if (request.getProvider() != null && !request.getProvider().isBlank()) {
            return MeetingProvider.fromString(request.getProvider()).name();
        }
        List<LiveSessionProviderConfig> configs = configRepository
                .findByInstituteIdAndStatusIn(request.getInstituteId(), ACTIVE);
        if (configs.isEmpty()) {
            throw new VacademyException(
                    "No live session provider connected for institute: " + request.getInstituteId());
        }
        return configs.get(0).getProvider();
    }

    private SessionSchedule getScheduleOrThrow(String scheduleId) {
        SessionSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new VacademyException("Schedule not found: " + scheduleId));
        if (schedule.getProviderMeetingId() == null || schedule.getProviderMeetingId().isBlank()) {
            throw new VacademyException("No provider meeting linked to schedule: " + scheduleId);
        }
        return schedule;
    }
}
