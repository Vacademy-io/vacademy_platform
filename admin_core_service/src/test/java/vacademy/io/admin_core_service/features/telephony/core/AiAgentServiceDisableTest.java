package vacademy.io.admin_core_service.features.telephony.core;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiAgentDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiAgent;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiAgentRepository;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallQueueItemRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Turning an agent off (or deleting it) cancels the calls still waiting for it, from any path. */
class AiAgentServiceDisableTest {

    private AiAgentRepository repo;
    private AiCallQueueItemRepository queue;
    private AiAgentSpeechWarmer warmer;
    private AiAgentService service;
    private AiAgent stored;

    @BeforeEach
    void setUp() {
        repo = mock(AiAgentRepository.class);
        queue = mock(AiCallQueueItemRepository.class);
        warmer = mock(AiAgentSpeechWarmer.class);
        InstituteRepository institutes = mock(InstituteRepository.class);
        when(institutes.findById(anyString())).thenReturn(Optional.empty()); // bridge is best-effort
        service = new AiAgentService(repo, institutes, mock(InstituteSettingService.class), warmer, queue);
        stored = AiAgent.builder().id("a-1").instituteId("inst-1").name("Riya").enabled(true)
                .direction("OUTBOUND").ttsModel("google").voice("hi-IN-Chirp3-HD-Achird").build();
        when(repo.findByIdAndInstituteId("a-1", "inst-1")).thenReturn(Optional.of(stored));
        when(repo.save(any(AiAgent.class))).thenAnswer(i -> i.getArgument(0));
        when(queue.cancelQueuedForAgent(anyString(), anyString(), anyString(), anyString())).thenReturn(4);
    }

    private static AiAgentDTO dto(Boolean enabled) {
        return AiAgentDTO.builder().id("a-1").instituteId("inst-1").name("Riya").enabled(enabled)
                .systemPrompt("You are Riya.").openingLine("Hi!").build();
    }

    @Test
    void turningAnAgentOffCancelsItsWaitingCallsAndSkipsTheWarm() {
        AiAgentService.SaveResult r = service.saveWithResult(dto(false));
        assertEquals(4, r.cancelledCalls());
        assertFalse(r.agent().getEnabled());
        verify(queue).cancelQueuedForAgent("inst-1", "a-1", "Riya", AiAgentService.CANCEL_REASON_DISABLED);
        verify(warmer, never()).warm(any());
    }

    @Test
    void savingAnEnabledAgentCancelsNothingAndWarms() {
        AiAgentService.SaveResult r = service.saveWithResult(dto(true));
        assertEquals(0, r.cancelledCalls());
        verify(queue, never()).cancelQueuedForAgent(any(), any(), any(), any());
        verify(warmer).warm(any());
    }

    @Test
    void savingAnAlreadyDisabledAgentDoesNotCancelAgain() {
        stored.setEnabled(false);
        assertEquals(0, service.saveWithResult(dto(false)).cancelledCalls());
        verify(queue, never()).cancelQueuedForAgent(any(), any(), any(), any());
    }

    @Test
    void deletingCancelsWaitingCalls() {
        assertEquals(4, service.delete("a-1", "inst-1"));
        verify(queue).cancelQueuedForAgent("inst-1", "a-1", "Riya", AiAgentService.CANCEL_REASON_DELETED);
        verify(repo).delete(stored);
    }

    @Test
    void aCancelFailureNeverFailsTheSave() {
        when(queue.cancelQueuedForAgent(anyString(), anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("db"));
        assertEquals(0, service.saveWithResult(dto(false)).cancelledCalls());
    }
}
