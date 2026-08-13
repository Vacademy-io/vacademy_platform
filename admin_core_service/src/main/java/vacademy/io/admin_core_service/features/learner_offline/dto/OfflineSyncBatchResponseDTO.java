package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineSyncBatchResponseDTO {
    private OfflineDeviceStatus deviceStatus;
    private List<OfflineSyncEventResultDTO> results;
}
