package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.List;

/**
 * DTO for campaign/audience filtering criteria
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CampaignFilterDTO {

    private List<String> audienceIds;         // Filter by specific audience/campaign IDs
    private String campaignName;              // Filter by campaign name
    private String campaignStatus;            // Filter by campaign status (ACTIVE, PAUSED, COMPLETED, ARCHIVED)
    private String campaignType;              // Filter by campaign type (WEBSITE, GOOGLE_ADS, etc.)
    private Timestamp startDateFromLocal;     // Filter campaigns starting from this date
    private Timestamp startDateToLocal;       // Filter campaigns starting until this date
}
