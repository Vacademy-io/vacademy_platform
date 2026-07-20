package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for terminating learners in sub-organization
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgTerminateRequestDTO {
    private String subOrgId;
    private String instituteId;
    private String packageSessionId;
    private List<String> userIds;

    /**
     * SOFT — keep the learner ACTIVE, moving their access cut-off to
     * {@link #accessTillDate} (access continues until then). HARD — terminate
     * immediately (the pre-existing behaviour). Defaults to HARD when blank so
     * older callers are unaffected.
     */
    private String mode;

    /**
     * SOFT-mode "last access date" (bare {@code yyyy-MM-dd} or full ISO-8601).
     * Required for a meaningful SOFT termination; ignored for HARD.
     */
    private String accessTillDate;
}
