package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;

/**
 * One learner-device pair holding offline content for a batch (offline plan
 * Part A5). A learner can register more than one device, and revoking is
 * per-device, so the admin table is keyed on the pair rather than the learner.
 */
@Getter
@Setter
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineLearnerDownloadDTO {
    private String userId;
    private String fullName;
    private String username;
    private String email;
    /** offline_device.id — what POST /devices/{id}/revoke takes. */
    private String deviceId;
    private String deviceName;
    private String platform;
    /** ACTIVE or REVOKED. */
    private String deviceStatus;
    private Timestamp lastCheckinAt;
    /** When offline access lapses unless the device checks in again. */
    private Timestamp leaseExpiresAt;
    private long downloadedSlides;
    private Timestamp firstDownloadedAt;
    private Timestamp lastDownloadedAt;
}
