package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Bulk-assign a set of students across a group of mentors, distributed equally
 * (least-loaded greedy). Existing mentor→student pairs are skipped.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BulkRoundRobinRequest {
    private String instituteId;
    private List<String> studentUserIds;
    private List<String> mentorIds;
    private String packageSessionId; // optional batch context
}
