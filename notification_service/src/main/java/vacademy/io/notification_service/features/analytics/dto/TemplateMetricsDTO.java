package vacademy.io.notification_service.features.analytics.dto;

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
public class TemplateMetricsDTO {
    private String templateIdentifier;
    private String subTemplateLabel;
    private OutgoingMetricsDTO outgoing;
    private IncomingMetricsDTO incoming;
    private Double responseRate;
}

