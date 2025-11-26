package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * DTO for filtering Audience campaigns
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudienceFilterDTO {

    private String instituteId;
    private String campaignName;
    private String status; // ACTIVE, PAUSED, COMPLETED, ARCHIVED
    private String campaignType; // WEBSITE, GOOGLE_ADS, etc.
    private Timestamp startDateFromLocal;
    private Timestamp startDateToLocal;
    
    // Pagination
    private Integer page;
    private Integer size;
    private String sortBy;
    private String sortDirection;
}

