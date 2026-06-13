package vacademy.io.community_service.feature.status.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.community_service.feature.status.enums.IncidentStatus;

/**
 * Body for POST /community-service/admin/v1/status/incidents/{id}/updates.
 * When {@code status} is present, it also advances the incident's current status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddIncidentUpdateRequest {
    private IncidentStatus status;
    private String message;
}
