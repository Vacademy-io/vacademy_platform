package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** The learner's own gamification summary for their profile: badges + best course rank. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LearnerSummaryDTO {
    private long totalBadges;
    /** Best (lowest) rank across the learner's enrolled courses; null if no ranked activity. */
    private Integer bestRank;
    private List<LeaderboardBadgeDTO> badges;
}
