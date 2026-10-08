package vacademy.io.admin_core_service.features.points_ledger.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** The learner's own points state — replaces the browser-computed XP figure. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PointsSummaryDTO {
    private long totalPoints;
    /** Points earned since the start of the current week (institute timezone). */
    private long weekPoints;
    /** Points earned today (institute timezone). */
    private long todayPoints;
    private int level;
    /** Points still needed to reach the next level. */
    private int pointsToNextLevel;
    /** Per-source split, for the "where did my points come from" explainer. */
    private List<PointsBreakdownItemDTO> breakdown;
}
