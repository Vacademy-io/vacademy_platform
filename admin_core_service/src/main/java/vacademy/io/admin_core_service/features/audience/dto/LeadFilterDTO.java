package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

/**
 * DTO for filtering leads/responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadFilterDTO {

    private String audienceId;
    private String sourceType; // WEBSITE, GOOGLE_ADS, etc.
    private String sourceId;
    private Timestamp submittedFrom;
    private Timestamp submittedTo;
    private Boolean converted; // true = has user_id, false = user_id is null
    
    // Pagination
    private Integer page;
    private Integer size;
    private String sortBy;
    private String sortDirection;
}

