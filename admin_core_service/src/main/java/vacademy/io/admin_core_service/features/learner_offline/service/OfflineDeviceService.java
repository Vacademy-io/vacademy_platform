package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineAccessSettingsPojo;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineRevocationReason;
import vacademy.io.admin_core_service.features.learner_offline.exception.OfflineDeviceLimitExceededException;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

/**
 * CRUD + lifecycle over offline_device (offline plan, Part A3). No key
 * custody lives here -- encryption keys are device-local (Keychain/Keystore)
 * and never transmitted; this service only gates how many concurrent ACTIVE
 * devices a learner may have and carries revocation state that
 * OfflineCheckInService turns into a client-side purge.
 */
@Service
@RequiredArgsConstructor
public class OfflineDeviceService {

    private final OfflineDeviceRepository offlineDeviceRepository;
    private final OfflineSettingService offlineSettingService;

    /**
     * Registers (or reactivates) a device. Re-registering an already-known
     * clientDeviceId reactivates the existing row and does NOT count against
     * the max-devices cap. A genuinely new device is created only after
     * pessimistic-locking the caller's ACTIVE rows and checking the cap, so
     * concurrent registrations can't race past it.
     */
    @Transactional
    public OfflineDeviceDTO register(String userId, String instituteId, String deviceName, String platform,
            String clientDeviceId) {
        if (!StringUtils.hasText(clientDeviceId)) {
            throw new VacademyException("deviceId is required");
        }

        OfflineDevice existing = offlineDeviceRepository.findByUserIdAndClientDeviceId(userId, clientDeviceId)
                .orElse(null);
        if (existing != null) {
            existing.setStatus(OfflineDeviceStatus.ACTIVE);
            existing.setDeviceName(deviceName);
            existing.setPlatform(platform);
            existing.setInstituteId(instituteId);
            existing.setRevokedAt(null);
            existing.setRevokedByUserId(null);
            existing.setRevokeReason(null);
            renewLease(existing, instituteId);
            offlineDeviceRepository.save(existing);
            return OfflineDeviceDTO.from(existing);
        }

        // Pessimistic lock scoped to this user's ACTIVE rows so a concurrent
        // register() for the same learner can't both observe "under cap".
        List<OfflineDevice> activeDevices = offlineDeviceRepository.findActiveForUpdateByUserId(userId);
        int maxDevices = offlineSettingService.get(instituteId).getMaxDevices();
        if (activeDevices.size() >= maxDevices) {
            List<OfflineDeviceDTO> deviceDTOs = activeDevices.stream()
                    .map(OfflineDeviceDTO::from)
                    .collect(Collectors.toList());
            throw new OfflineDeviceLimitExceededException(
                    "Maximum of " + maxDevices + " offline devices already registered", deviceDTOs);
        }

        OfflineDevice device = new OfflineDevice();
        device.setUserId(userId);
        device.setInstituteId(instituteId);
        device.setDeviceName(deviceName);
        device.setPlatform(platform);
        device.setClientDeviceId(clientDeviceId);
        device.setStatus(OfflineDeviceStatus.ACTIVE);
        device.setRegisteredAt(Timestamp.from(Instant.now()));
        renewLease(device, instituteId);
        offlineDeviceRepository.save(device);
        return OfflineDeviceDTO.from(device);
    }

    /** Ownership-checked self-revoke -- a learner removing their own device. */
    @Transactional
    public void selfRevoke(String userId, String deviceId) {
        OfflineDevice device = offlineDeviceRepository.findByIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Device not found"));
        device.setStatus(OfflineDeviceStatus.REVOKED);
        device.setRevokedAt(Timestamp.from(Instant.now()));
        device.setRevokedByUserId(userId);
        device.setRevokeReason(OfflineRevocationReason.DEVICE_REVOKED.name());
        offlineDeviceRepository.save(device);
    }

    public List<OfflineDeviceDTO> list(String userId, String instituteId) {
        return offlineDeviceRepository.findByUserIdAndInstituteIdOrderByRegisteredAtDesc(userId, instituteId)
                .stream().map(OfflineDeviceDTO::from).collect(Collectors.toList());
    }

    /** Admin cross-institute device listing for a given user. */
    public List<OfflineDeviceDTO> listForAdmin(String userId) {
        return offlineDeviceRepository.findByUserIdOrderByRegisteredAtDesc(userId)
                .stream().map(OfflineDeviceDTO::from).collect(Collectors.toList());
    }

    @Transactional
    public void adminRevoke(String deviceId, String reason, String adminUserId) {
        OfflineDevice device = offlineDeviceRepository.findById(deviceId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Device not found"));
        device.setStatus(OfflineDeviceStatus.REVOKED);
        device.setRevokedAt(Timestamp.from(Instant.now()));
        device.setRevokedByUserId(adminUserId);
        device.setRevokeReason(StringUtils.hasText(reason) ? reason : OfflineRevocationReason.DEVICE_REVOKED.name());
        offlineDeviceRepository.save(device);
    }

    /** now + institute's revalidationDays, used at both register() and check-in. */
    public void renewLease(OfflineDevice device, String instituteId) {
        OfflineAccessSettingsPojo settings = offlineSettingService.get(instituteId);
        device.setLeaseExpiresAt(Timestamp.from(Instant.now().plus(settings.getRevalidationDays(), ChronoUnit.DAYS)));
    }
}
