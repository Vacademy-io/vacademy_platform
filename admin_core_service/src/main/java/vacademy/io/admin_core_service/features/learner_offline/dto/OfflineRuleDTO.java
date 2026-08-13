package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineAccessRule;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineRuleDTO {
    private String id;
    private OfflineSourceType sourceType;
    private String sourceId;
    private String packageSessionId;
    private Boolean allow;

    public static OfflineRuleDTO from(OfflineAccessRule rule) {
        return new OfflineRuleDTO(rule.getId(), rule.getSourceType(), rule.getSourceId(),
                rule.getPackageSessionId(), rule.getAllow());
    }
}
