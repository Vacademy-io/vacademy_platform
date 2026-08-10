package vacademy.io.admin_core_service.features.learner_offline.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineDeviceDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * Thrown by OfflineDeviceService.register() when the caller's ACTIVE device
 * count is already at the institute's OFFLINE_ACCESS_SETTING.maxDevices cap
 * and the incoming clientDeviceId doesn't match an existing (reactivatable)
 * row (offline plan, Part A3). Carries the caller's current device list so
 * LearnerOfflineDeviceController's local @ExceptionHandler can surface it in
 * the 409 body for the client's "remove a device" UX.
 */
@Getter
public class OfflineDeviceLimitExceededException extends VacademyException {

    public static final String CODE = "DEVICE_LIMIT_REACHED";

    private final List<OfflineDeviceDTO> devices;

    public OfflineDeviceLimitExceededException(String message, List<OfflineDeviceDTO> devices) {
        super(HttpStatus.CONFLICT, message);
        this.devices = devices;
    }
}
