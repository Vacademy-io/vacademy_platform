package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType;

/**
 * One rule write in a bulk upsert request. {@code allow=null} deletes the
 * rule (UI "Inherit"); {@code allow=true/false} upserts it.
 */
@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineRuleUpsertDTO {
    private OfflineSourceType sourceType;
    private String sourceId;
    /** Required for every source type except PACKAGE. For PACKAGE_SESSION rules this equals sourceId. */
    private String packageSessionId;
    private Boolean allow;
}
