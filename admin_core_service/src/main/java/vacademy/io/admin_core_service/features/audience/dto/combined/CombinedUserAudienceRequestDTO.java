package vacademy.io.admin_core_service.features.audience.dto.combined;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

/**
 * Request DTO for combined users and audience API
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CombinedUserAudienceRequestDTO {

    @NotBlank(message = "Institute ID is required")
    private String instituteId;
    
    // Source selection flags (control which user sources to include)
    private Boolean includeInstituteUsers;     // If true, include institute enrolled users
    private Boolean includeAudienceRespondents; // If true, include audience campaign respondents
    
    // Audience/Campaign filters
    private CampaignFilterDTO campaignFilter;
    
    // User filters
    private UserFilterDTO userFilter;
    
    // Pagination
    private Integer page;
    private Integer size;
    private String sortBy;
    private String sortDirection;
}
