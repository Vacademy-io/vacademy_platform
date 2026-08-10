package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineDeviceDTO {
    private String id;
    private String deviceName;
    private String platform;
    private OfflineDeviceStatus status;
    private String clientDeviceId;
    private Timestamp leaseExpiresAt;
    private Timestamp lastCheckinAt;
    private Timestamp registeredAt;
    private Timestamp revokedAt;
    private String revokeReason;

    public static OfflineDeviceDTO from(OfflineDevice device) {
        return new OfflineDeviceDTO(
                device.getId(),
                device.getDeviceName(),
                device.getPlatform(),
                device.getStatus(),
                device.getClientDeviceId(),
                device.getLeaseExpiresAt(),
                device.getLastCheckinAt(),
                device.getRegisteredAt(),
                device.getRevokedAt(),
                device.getRevokeReason());
    }
}
