package vacademy.io.admin_core_service.features.applicant.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for POST /v1/applicant/list API
 * Supports multiple filters applied collectively
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ApplicantListRequestDTO {

    /**
     * Institute ID filter
     */
    private String instituteId;

    /**
     * Source type filter (e.g., LEVEL, INSTITUTE, CAMPAIGN)
     */
    private String source;

    /**
     * Source ID filter
     */
    private String sourceId;

    /**
     * Application Stage ID filter
     */
    private String applicationStageId;

    /**
     * Package Session IDs filter - supports multiple values
     */
    private List<String> packageSessionIds;

    /**
     * Overall Status filter - supports multiple values (e.g., PENDING, APPROVED, REJECTED)
     */
    private List<String> overallStatuses;

    /**
     * Search string for matching:
     * - tracking_id
     * - applicant_id
     * - application_stage_id
     */
    private String search;
}
