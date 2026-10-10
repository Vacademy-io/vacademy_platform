package vacademy.io.admin_core_service.features.utm_attribution.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/** One ad campaign that has sent leads, as the campaign-naming list renders it. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UtmCampaignRowResponse {
    /** The utm_campaign value — for Google lead forms, the campaign id. */
    private String campaign;
    /** Distinct people with a touch on this campaign. */
    private long people;
    private Timestamp firstSeen;
    private Timestamp lastSeen;
    /** Admin-given name, or null when not named yet. */
    private String name;
}
