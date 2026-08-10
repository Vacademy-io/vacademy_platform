package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineRevocationReason;

/** One package session the client must purge locally, per check-in (offline plan, Part A3). */
@Data
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineRevocationDTO {
    private String packageSessionId;
    private OfflineRevocationReason reason;
    private final String action = "PURGE";

    public OfflineRevocationDTO(String packageSessionId, OfflineRevocationReason reason) {
        this.packageSessionId = packageSessionId;
        this.reason = reason;
    }
}
