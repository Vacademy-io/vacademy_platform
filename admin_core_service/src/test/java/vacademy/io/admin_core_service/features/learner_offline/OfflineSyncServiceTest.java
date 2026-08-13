package vacademy.io.admin_core_service.features.learner_offline;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncBatchResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncEventRequestDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineSyncEventResultDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSyncEventStatus;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSyncEventProcessor;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSyncService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Batch-level orchestration: ordering, device gating, size limit (offline plan Part A4). */
@ExtendWith(MockitoExtension.class)
class OfflineSyncServiceTest {

    private static final String USER = "u1";
    private static final String DEVICE = "dev1";

    @Mock private OfflineDeviceRepository offlineDeviceRepository;
    @Mock private OfflineSyncEventProcessor offlineSyncEventProcessor;
    @InjectMocks private OfflineSyncService offlineSyncService;

    private CustomUserDetails user;
    private OfflineDevice device;

    @BeforeEach
    void setUp() {
        user = new CustomUserDetails();
        ReflectionTestUtils.setField(user, "userId", USER);
        device = new OfflineDevice();
        device.setId(DEVICE);
        device.setUserId(USER);
        device.setStatus(OfflineDeviceStatus.ACTIVE);
    }

    private OfflineSyncEventRequestDTO event(String id, long seq) {
        OfflineSyncEventRequestDTO e = new OfflineSyncEventRequestDTO();
        e.setClientEventId(id);
        e.setSeq(seq);
        e.setClientTs(seq);
        e.setEventType("VIDEO");
        e.setSlideId("slide1");
        return e;
    }

    @Test
    @DisplayName("events are sorted by seq before being dispatched to the processor")
    void eventsSortedBySeq() {
        when(offlineDeviceRepository.findByIdAndUserId(DEVICE, USER)).thenReturn(Optional.empty());
        when(offlineDeviceRepository.findByUserIdAndClientDeviceId(USER, DEVICE)).thenReturn(Optional.of(device));
        when(offlineSyncEventProcessor.process(any(), eq(DEVICE), eq(user)))
                .thenAnswer(inv -> OfflineSyncEventResultDTO.of(
                        ((OfflineSyncEventRequestDTO) inv.getArgument(0)).getClientEventId(),
                        OfflineSyncEventStatus.ACCEPTED));

        OfflineSyncBatchRequest request = new OfflineSyncBatchRequest();
        request.setDeviceId(DEVICE);
        List<OfflineSyncEventRequestDTO> events = new ArrayList<>();
        events.add(event("second", 2));
        events.add(event("first", 1));
        request.setEvents(events);

        offlineSyncService.processBatch(request, user);

        ArgumentCaptor<OfflineSyncEventRequestDTO> captor = ArgumentCaptor.forClass(OfflineSyncEventRequestDTO.class);
        InOrder inOrder = inOrder(offlineSyncEventProcessor);
        inOrder.verify(offlineSyncEventProcessor, times(2)).process(captor.capture(), eq(DEVICE), eq(user));
        List<OfflineSyncEventRequestDTO> captured = captor.getAllValues();
        assertEquals("first", captured.get(0).getClientEventId());
        assertEquals("second", captured.get(1).getClientEventId());
    }

    @Test
    @DisplayName("revoked device still has its batch processed; response carries deviceStatus REVOKED")
    void revokedDeviceStillProcessesBatch() {
        device.setStatus(OfflineDeviceStatus.REVOKED);
        when(offlineDeviceRepository.findByIdAndUserId(DEVICE, USER)).thenReturn(Optional.of(device));
        when(offlineSyncEventProcessor.process(any(), eq(DEVICE), eq(user)))
                .thenReturn(OfflineSyncEventResultDTO.of("e1", OfflineSyncEventStatus.ACCEPTED));

        OfflineSyncBatchRequest request = new OfflineSyncBatchRequest();
        request.setDeviceId(DEVICE);
        request.setEvents(List.of(event("e1", 1)));

        OfflineSyncBatchResponseDTO response = offlineSyncService.processBatch(request, user);

        assertEquals(OfflineDeviceStatus.REVOKED, response.getDeviceStatus());
        verify(offlineSyncEventProcessor).process(any(), eq(DEVICE), eq(user));
    }

    @Test
    @DisplayName("batch of more than 100 events is rejected")
    void batchTooLargeRejected() {
        // Size is checked before device resolution, so no repository stubbing is needed here.
        List<OfflineSyncEventRequestDTO> events = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            events.add(event("e" + i, i));
        }
        OfflineSyncBatchRequest request = new OfflineSyncBatchRequest();
        request.setDeviceId(DEVICE);
        request.setEvents(events);

        assertThrows(VacademyException.class, () -> offlineSyncService.processBatch(request, user));
        verify(offlineSyncEventProcessor, never()).process(any(), any(), any());
    }
}
