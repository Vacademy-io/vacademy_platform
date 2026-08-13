package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;

import java.sql.Timestamp;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineCheckInResponseDTO {
    private OfflineDeviceStatus deviceStatus;
    private Timestamp leaseExpiresAt;
    private List<OfflineRevocationDTO> revocations;
    private List<OfflineManifestUpdateDTO> manifestUpdates;
}
