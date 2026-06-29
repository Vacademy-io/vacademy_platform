package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A badge shown against a leaderboard entry (icon + name; no PII). */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardBadgeDTO {
    private String name;
    private String icon;
}
