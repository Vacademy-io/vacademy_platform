package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The child's gamification points — engagement points (total focused-activity
 * minutes) across all their courses, plus their best institute-wide rank.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ParentPointsDTO {
    private long points;
    /** Institute-wide rank; null if the child has no ranked activity yet. */
    private Integer rank;
}
