package vacademy.io.admin_core_service.features.learner_management.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkDeassignRequestDTO {

    private String instituteId;

    /** Explicit user IDs to de-assign */
    private List<String> userIds;

    /** Filter-based user selection (merged with userIds) */
    private UserFilterDTO userFilter;

    /** Package sessions to remove users from */
    private List<String> packageSessionIds;

    /** Options: mode, notifications, dry-run */
    private DeassignOptionsDTO options;
}
