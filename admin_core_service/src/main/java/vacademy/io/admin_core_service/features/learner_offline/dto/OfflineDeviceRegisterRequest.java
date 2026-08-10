package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineDeviceRegisterRequest {
    private String deviceName;
    private String platform;
    /** Stable Capacitor Device.getId() value -- becomes offline_device.client_device_id. */
    private String deviceId;
}
