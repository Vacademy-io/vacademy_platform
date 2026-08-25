package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * An admin's decision on a mentor request. On approve, {@code mentorId} picks the
 * mentor for an open-ended ("any mentor") request, or overrides the one the learner
 * asked for. {@code note} is the reason shown to the learner on a decline.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorRequestDecisionDTO {
    private String mentorId;
    private String note;
}
