package vacademy.io.community_service.feature.status.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.community_service.feature.status.enums.IncidentSeverity;
import vacademy.io.community_service.feature.status.enums.IncidentStatus;

import java.util.Date;
import java.util.List;

/**
 * Body for PATCH /community-service/admin/v1/status/incidents/{id}.
 * Every field is optional; null means "leave unchanged".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateIncidentRequest {
    private String title;
    private IncidentStatus status;
    private IncidentSeverity severity;
    private List<String> affectedComponents;
    private Date startedAt;
    private Date resolvedAt;
}
