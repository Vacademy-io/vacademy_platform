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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Schema(description = "Request for daily participation analytics")
public class DailyParticipationRequestDTO {
    
    @Schema(description = "Institute ID", required = true)
    @NotBlank(message = "Institute ID is required")
    private String instituteId;
    
    @Schema(description = "Start date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss)")
    private LocalDateTime startDate;
    
    @Schema(description = "End date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss)")
    private LocalDateTime endDate;
}

