package vacademy.io.notification_service.features.analytics.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request for the lead-journey daily-message funnel.
 *
 * <p>Surfaces the multi-day WhatsApp drip (e.g. the Facebook-leads
 * {@code lead_journey_day_N_utility} sequence) that is NOT registered in
 * notification_template_day_map and therefore never appears in the
 * day-map-driven daily-participation report. Sends are matched purely by a
 * template-name prefix on the message body, scoped to an institute.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Schema(description = "Request for lead-journey daily-message funnel analytics")
public class LeadJourneyFunnelRequestDTO {

    @Schema(description = "Institute ID", required = true)
    @NotBlank(message = "Institute ID is required")
    private String instituteId;

    @Schema(description = "Optional WhatsApp business channel id; null = all channels of the institute")
    private String senderBusinessChannelId;

    @Schema(description = "Template-name prefix that identifies the journey. Defaults to 'lead_journey_day_'.")
    private String templatePrefix;

    @Schema(description = "Start date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss). Null = no lower bound.")
    private LocalDateTime startDate;

    @Schema(description = "End date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss). Null = no upper bound.")
    private LocalDateTime endDate;
}
