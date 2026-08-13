package vacademy.io.admin_core_service.features.learner_offline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineAccessSettingsPojo;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.exception.OfflineDeviceLimitExceededException;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDeviceService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSettingService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Device-cap + re-registration semantics (offline plan Part A3). */
@ExtendWith(MockitoExtension.class)
class OfflineDeviceServiceTest {

    @Mock
    private OfflineDeviceRepository offlineDeviceRepository;
    @Mock
    private OfflineSettingService offlineSettingService;
    @InjectMocks
    private OfflineDeviceService offlineDeviceService;

    private OfflineAccessSettingsPojo settingsWithMaxDevices(int maxDevices) {
        OfflineAccessSettingsPojo pojo = OfflineAccessSettingsPojo.defaults();
        pojo.setMaxDevices(maxDevices);
        return pojo;
    }

    private OfflineDevice activeDevice(String id, String clientDeviceId) {
        OfflineDevice device = new OfflineDevice();
        device.setId(id);
        device.setUserId("u1");
        device.setClientDeviceId(clientDeviceId);
        device.setStatus(OfflineDeviceStatus.ACTIVE);
        return device;
    }

    @Test
    @DisplayName("registering a new device at the cap throws DEVICE_LIMIT_REACHED with the current device list")
    void registerAtCapThrows() {
        when(offlineDeviceRepository.findByUserIdAndClientDeviceId("u1", "new-device"))
                .thenReturn(Optional.empty());
        when(offlineDeviceRepository.findActiveForUpdateByUserId("u1"))
                .thenReturn(List.of(activeDevice("d1", "cd1"), activeDevice("d2", "cd2")));
        when(offlineSettingService.get("inst1")).thenReturn(settingsWithMaxDevices(2));

        OfflineDeviceLimitExceededException ex = assertThrows(OfflineDeviceLimitExceededException.class,
                () -> offlineDeviceService.register("u1", "inst1", "New Phone", "ANDROID", "new-device"));

        assertEquals(2, ex.getDevices().size());
        verify(offlineDeviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("re-registering a known clientDeviceId reactivates it and does not consume a slot")
    void reRegisterSameClientDeviceIdSkipsCap() {
        OfflineDevice existing = activeDevice("d1", "cd1");
        existing.setStatus(OfflineDeviceStatus.REVOKED);
        when(offlineDeviceRepository.findByUserIdAndClientDeviceId("u1", "cd1"))
                .thenReturn(Optional.of(existing));
        when(offlineSettingService.get(anyString())).thenReturn(settingsWithMaxDevices(2));

        offlineDeviceService.register("u1", "inst1", "Same Phone", "ANDROID", "cd1");

        assertEquals(OfflineDeviceStatus.ACTIVE, existing.getStatus());
        assertNull(existing.getRevokedAt());
        assertNotNull(existing.getLeaseExpiresAt());
        verify(offlineDeviceRepository, never()).findActiveForUpdateByUserId(anyString());
        verify(offlineDeviceRepository).save(existing);
    }

    @Test
    @DisplayName("registering under the cap creates an ACTIVE device with a lease")
    void registerUnderCapSucceeds() {
        when(offlineDeviceRepository.findByUserIdAndClientDeviceId("u1", "new-device"))
                .thenReturn(Optional.empty());
        when(offlineDeviceRepository.findActiveForUpdateByUserId("u1"))
                .thenReturn(List.of(activeDevice("d1", "cd1")));
        when(offlineSettingService.get("inst1")).thenReturn(settingsWithMaxDevices(2));

        var dto = offlineDeviceService.register("u1", "inst1", "New Phone", "IOS", "new-device");

        assertEquals(OfflineDeviceStatus.ACTIVE, dto.getStatus());
        verify(offlineDeviceRepository).save(any(OfflineDevice.class));
    }
}
