package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkDeassignResponseDTO {

    private boolean dryRun;

    private SummaryDTO summary;

    private List<DeassignResultItemDTO> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SummaryDTO {
        private int totalRequested;
        private int successful;
        private int failed;
        private int skipped;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DeassignResultItemDTO {
        private String userId;
        private String userEmail;
        private String packageSessionId;

        /** SUCCESS | SKIPPED | FAILED */
        private String status;

        /** SOFT_CANCELED | HARD_TERMINATED | NONE */
        private String actionTaken;

        private String userPlanId;
        private String message;

        /** Warning if UserPlan is shared across multiple package sessions */
        private String warning;
    }
}
