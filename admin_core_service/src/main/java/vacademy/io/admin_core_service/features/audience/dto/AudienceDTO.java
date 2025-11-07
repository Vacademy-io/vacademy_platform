package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.sql.Timestamp;
import java.util.List;

/**
 * DTO for Audience Campaign creation and management
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudienceDTO {

    private String id;
    private String instituteId;
    private String campaignName;
    private String campaignType; // Comma-separated: "WEBSITE,GOOGLE_ADS,FACEBOOK_ADS"
    private String description;
    private String campaignObjective; // LEAD_GENERATION, EVENT_REGISTRATION, etc.
    private Timestamp startDateLocal;
    private Timestamp endDateLocal;
    private String status; // ACTIVE, PAUSED, COMPLETED, ARCHIVED
    private String jsonWebMetadata;
    private String createdByUserId;

    // Custom fields for the form
    private List<InstituteCustomFieldDTO> instituteCustomFields;
}

