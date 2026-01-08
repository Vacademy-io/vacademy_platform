package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CenterHeatmapRequestDTO {
    
    @Parameter(description = "Institute ID", required = true)
    @NotBlank(message = "Institute ID is required")
    private String instituteId;
    
    @Parameter(description = "Start date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss)")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startDate;
    
    @Parameter(description = "End date filter (ISO format: yyyy-MM-dd'T'HH:mm:ss)")
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endDate;
    
    @Parameter(description = "Campaign status filter (ACTIVE, PAUSED, COMPLETED, ARCHIVED)")
    private String status;
}
