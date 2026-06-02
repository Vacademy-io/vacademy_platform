package vacademy.io.admin_core_service.features.live_session.provider.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests the #3 provisioning-recovery additions: persisting the Zoom config on the
 * session and re-provisioning pending occurrences from that stored config.
 * Constructs the service with a REAL ObjectMapper (serialization matters here).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProviderMeetingBatchProvisioningTest {

    private static final String SESSION_ID = "sess-1";

    @Mock private LiveSessionProviderService providerService;
    @Mock private SessionScheduleRepository scheduleRepository;
    @Mock private LiveSessionRepository liveSessionRepository;

    private ProviderMeetingBatchService service() {
        return new ProviderMeetingBatchService(
                providerService, scheduleRepository, liveSessionRepository, new ObjectMapper());
    }

    @Test
    void rememberProvisioningConfigPersistsAccountAndSerializedConfig() {
        LiveSession session = LiveSession.builder().id(SESSION_ID).instituteId("inst-1").build();
        when(liveSessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));

        service().rememberProvisioningConfig(ProviderMeetingCreateRequestDTO.builder()
                .sessionId(SESSION_ID).providerAccountId("acct-1")
                .providerConfig(Map.of("waitingRoom", true)).build());

        assertEquals("acct-1", session.getZoomAccountId());
        assertNotNull(session.getZoomConfigJson());
        assertTrue(session.getZoomConfigJson().contains("waitingRoom"));
        verify(liveSessionRepository).save(session);
    }

    @Test
    void rememberProvisioningConfigNoOpWithoutAccount() {
        service().rememberProvisioningConfig(ProviderMeetingCreateRequestDTO.builder()
                .sessionId(SESSION_ID).build()); // no account
        verify(liveSessionRepository, never()).save(any());
    }

    @Test
    void reprovisionRebuildsRequestFromStoredConfigAndProvisionsPending() {
        LiveSession session = LiveSession.builder()
                .id(SESSION_ID).instituteId("inst-1").title("Calculus")
                .zoomAccountId("acct-1").zoomConfigJson("{\"waitingRoom\":true,\"autoRecording\":\"cloud\"}")
                .timezone("Asia/Kolkata").build();
        SessionSchedule pending = SessionSchedule.builder()
                .id("r1").sessionId(SESSION_ID).status("LIVE").providerMeetingId(null)
                .meetingDate(java.sql.Date.valueOf(LocalDate.of(2026, 6, 10)))
                .startTime(Time.valueOf("10:00:00")).lastEntryTime(Time.valueOf("11:00:00")).build();
        when(liveSessionRepository.findById(SESSION_ID)).thenReturn(Optional.of(session));
        when(scheduleRepository.findBySessionId(SESSION_ID)).thenReturn(List.of(pending));

        int created = service().reprovisionFromStoredConfig(session);

        assertEquals(1, created);
        ArgumentCaptor<ProviderMeetingCreateRequestDTO> captor =
                ArgumentCaptor.forClass(ProviderMeetingCreateRequestDTO.class);
        verify(providerService).createMeeting(captor.capture());
        ProviderMeetingCreateRequestDTO req = captor.getValue();
        assertEquals("ZOOM_MEETING", req.getProvider());
        assertEquals("acct-1", req.resolveProviderAccountId());
        assertEquals("r1", req.getScheduleId());
        assertEquals(Boolean.TRUE, req.resolveProviderConfig().get("waitingRoom")); // parsed from stored JSON
    }

    @Test
    void reprovisionNoOpWithoutStoredAccount() {
        LiveSession session = LiveSession.builder().id(SESSION_ID).build(); // no zoomAccountId
        assertEquals(0, service().reprovisionFromStoredConfig(session));
        verify(providerService, never()).createMeeting(any());
    }
}
