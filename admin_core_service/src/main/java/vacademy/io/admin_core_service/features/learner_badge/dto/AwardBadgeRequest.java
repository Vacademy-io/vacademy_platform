package vacademy.io.admin_core_service.features.learner_badge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request to manually award a configured badge to one or more learners.
 * Accepts a list of userIds so a future bulk-award UI needs no API change.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AwardBadgeRequest {

    @NotEmpty(message = "userIds cannot be empty")
    private List<String> userIds;

    @NotBlank(message = "badgeId is required")
    private String badgeId;

    // Snapshot of the badge's presentation at award time.
    private String badgeName;
    private String badgeIcon;
    private String badgeDescription;

    private String reason;
}
