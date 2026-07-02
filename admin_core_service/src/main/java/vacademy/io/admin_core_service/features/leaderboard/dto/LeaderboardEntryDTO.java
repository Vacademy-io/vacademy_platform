package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** One row of a course/batch leaderboard. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntryDTO {
    private Integer rank;
    /** Null for other learners in anonymized (learner-facing) mode. */
    private String userId;
    /** Full name for admins; initials (or "You") for the learner-facing, anonymized view. */
    private String name;
    /** Engagement points = total focused-activity minutes. */
    private long points;
    private long badgeCount;
    /** The learner's badges (most recent first, capped) for the leaderboard dialog. */
    private List<LeaderboardBadgeDTO> badges;
    private boolean currentUser;
}
