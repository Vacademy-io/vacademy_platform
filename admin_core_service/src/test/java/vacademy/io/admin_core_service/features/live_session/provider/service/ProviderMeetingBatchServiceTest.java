package vacademy.io.admin_core_service.features.live_session.provider.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderMeetingCreateRequestDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;

import java.sql.Time;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ProviderMeetingBatchService} — server-side per-occurrence
 * meeting provisioning for recurring sessions.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProviderMeetingBatchServiceTest {

    private static final String SESSION_ID = "sess-1";
    private static final String INSTITUTE_ID = "inst-1";

    @Mock private LiveSessionProviderService providerService;
    @Mock private SessionScheduleRepository scheduleRepository;
    @Mock private LiveSessionRepository liveSessionRepository;

    @InjectMocks private ProviderMeetingBatchService batchService;

    private SessionSchedule schedule(String id, String status, String providerMeetingId, LocalDate date) {
        return SessionSchedule.builder()
                .id(id).sessionId(SESSION_ID).status(status).providerMeetingId(providerMeetingId)
                .meetingDate(java.sql.Date.valueOf(date))
                .startTime(Time.valueOf("10:00:00"))
                .lastEntryTime(Time.valueOf("11:00:00"))
                .build();
    }

    private ProviderMeetingCreateRequestDTO request() {
        return ProviderMeetingCreateRequestDTO.builder()
                .instituteId(INSTITUTE_ID).sessionId(SESSION_ID)
                .provider("ZOOM_MEETING").zoomAccountId("acct-1")
                .topic("Calculus").durationMinutes(30)
                .build();
    }

    @Test
    void createsOnlyForUnprovisionedNonDeletedSchedules() {
        List<SessionSchedule> all = List.of(
                schedule("A", "LIVE", null, LocalDate.of(2026, 6, 10)),     // pending
                schedule("B", "LIVE", "999", LocalDate.of(2026, 6, 17)),     // already provisioned -> skip
                schedule("C", "DELETED", null, LocalDate.of(2026, 6, 24)),   // deleted -> skip
                schedule("D", "LIVE", "", LocalDate.of(2026, 7, 1)));        // blank id -> pending
        when(scheduleRepository.findBySessionId(SESSION_ID)).thenReturn(all);
        when(liveSessionRepository.findById(SESSION_ID))
                .thenReturn(Optional.of(LiveSession.builder().id(SESSION_ID).timezone("Asia/Kolkata").build()));

        int created = batchService.createMeetingsForSession(request());

        assertEquals(2, created);
        ArgumentCaptor<ProviderMeetingCreateRequestDTO> captor =
                ArgumentCaptor.forClass(ProviderMeetingCreateRequestDTO.class);
        verify(providerService, times(2)).createMeeting(captor.capture());
        List<String> scheduleIds = captor.getAllValues().stream()
                .map(ProviderMeetingCreateRequestDTO::getScheduleId).collect(Collectors.toList());
        assertTrue(scheduleIds.containsAll(List.of("A", "D")));
        // Each per-occurrence request keeps the provider/account/config and derives its own start time.
        ProviderMeetingCreateRequestDTO first = captor.getAllValues().get(0);
        assertEquals("ZOOM_MEETING", first.getProvider());
        assertEquals("acct-1", first.getZoomAccountId());
        assertNotNull(first.getStartTime());
        assertEquals(60, first.getDurationMinutes()); // 10:00 -> 11:00
    }

    @Test
    void countPendingExcludesProvisionedAndDeleted() {
        when(scheduleRepository.findBySessionId(SESSION_ID)).thenReturn(List.of(
                schedule("A", "LIVE", null, LocalDate.of(2026, 6, 10)),
                schedule("B", "LIVE", "999", LocalDate.of(2026, 6, 17)),
                schedule("C", "DELETED", null, LocalDate.of(2026, 6, 24))));
        assertEquals(1, batchService.countPending(SESSION_ID));
    }

    @Test
    void blankSessionIdIsNoOp() {
        assertEquals(0, batchService.createMeetingsForSession(
                ProviderMeetingCreateRequestDTO.builder().build()));
        verify(providerService, never()).createMeeting(any());
    }

    @Test
    void startTimeDerivedInSessionTimezone() {
        String iso = ProviderMeetingBatchService.toIsoStartTime(
                schedule("X", "LIVE", null, LocalDate.of(2026, 6, 10)), "Asia/Kolkata");
        assertTrue(iso.startsWith("2026-06-10T10:00"), iso);
        assertTrue(iso.endsWith("+05:30"), iso);
    }

    @Test
    void durationFallsBackWhenNoWindow() {
        SessionSchedule s = SessionSchedule.builder().id("X").startTime(Time.valueOf("10:00:00")).build();
        assertEquals(45, ProviderMeetingBatchService.deriveDurationMinutes(s, 45));
        assertEquals(60, ProviderMeetingBatchService.deriveDurationMinutes(s, 0));
    }
}
