package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSyncEventStatus;

@Getter
@Setter
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineSyncEventResultDTO {
    private String clientEventId;
    private OfflineSyncEventStatus status;
    private String errorCode;

    public static OfflineSyncEventResultDTO of(String clientEventId, OfflineSyncEventStatus status) {
        return new OfflineSyncEventResultDTO(clientEventId, status, null);
    }
}
