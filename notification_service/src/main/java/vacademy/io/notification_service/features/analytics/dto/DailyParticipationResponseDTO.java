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
public class DailyParticipationResponseDTO {
    private String instituteId;
    private DateRangeDTO dateRange;
    private DailyParticipationDataDTO dailyParticipation;
}

