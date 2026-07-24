package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.sql.Timestamp;

/**
 * Lightweight DTO summarising a user's participation in a single audience/campaign.
 * Returned by GET /admin-core-service/v1/audience/user-audiences?userId=...
 */
@Data
@Builder
public class UserAudienceMembershipDTO {

    @JsonProperty("audience_id")
    private String audienceId;

    @JsonProperty("campaign_name")
    private String campaignName;

    @JsonProperty("campaign_status")
    private String campaignStatus;

    @JsonProperty("response_id")
    private String responseId;

    @JsonProperty("overall_status")
    private String overallStatus;

    /**
     * ACTIVE | INACTIVE. Surfaced so the delete dialog's campaign picker can show which of the
     * person's leads are already deleted (and offer Restore) instead of silently omitting them —
     * the backing query intentionally returns deleted rows too.
     */
    @JsonProperty("audience_status")
    private String audienceStatus;

    @JsonProperty("source_type")
    private String sourceType;

    @JsonProperty("submitted_at")
    private Timestamp submittedAt;

    @JsonProperty("lead_score")
    private Integer leadScore;
}
