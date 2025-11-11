package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Map;

/**
 * DTO for Lead/Response submission
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AudienceResponseDTO {

    private String id;
    private String audienceId;
    private String userId;
    private String sourceType; // WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, etc.
    private String sourceId;
    private Timestamp submittedAtLocal;
    private Timestamp createdAtLocal;

    // Custom field values submitted by the lead
    // Key: customFieldId, Value: submitted value
    private Map<String, String> customFieldValues;
}

