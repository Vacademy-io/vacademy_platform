package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkAssignOptionsDTO {

    /**
     * How to handle users who are already enrolled:
     * SKIP — silently skip (default)
     * ERROR — mark as FAILED in response
     * RE_ENROLL — reactivate TERMINATED/EXPIRED mappings
     */
    @Builder.Default
    private String duplicateHandling = "SKIP";

    @Builder.Default
    private boolean notifyLearners = true;

    /** Optional external transaction reference */
    private String transactionId;

    /** true = preview only, no database writes */
    @Builder.Default
    private boolean dryRun = false;
}
