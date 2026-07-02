package vacademy.io.admin_core_service.features.counsellor_workbench.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Result of a bulk lead-assign (preview or commit). {@code dryRun} is true for
 * the preview endpoint. Each assignment maps a lead {@code userId} to its target
 * counsellor; the UI shows this proposal and, in MANUAL mode, lets the admin
 * override per row before committing.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AssignLeadsResultDTO {

    private Boolean dryRun;
    private Integer totalLeads;
    private List<AssignmentResult> assignments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class AssignmentResult {
        private String userId;                 // lead user_id
        private String toUserId;               // target counsellor
        private String toUserName;             // resolved display name (nullable)
    }
}
