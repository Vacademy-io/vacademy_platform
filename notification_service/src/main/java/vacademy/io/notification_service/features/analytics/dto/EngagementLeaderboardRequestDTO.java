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
public class EngagementLeaderboardRequestDTO {
    private String instituteId;
    private String startDate;
    private String endDate;
    private Integer page;
    private Integer pageSize;

    /**
     * Optional custom-field-based filter. Both must be provided to take effect.
     * The name is matched against the keys of UserWithCustomFieldsDTO.customFields
     * (which is the institute's CustomFields.field_name). The value is compared
     * case-insensitively against the user's stored value.
     * No field name is hardcoded server-side — the caller decides which custom
     * field to filter by (e.g. the institute's "center" field, "batch", etc.).
     */
    private String customFieldName;
    private String customFieldValue;
}
