package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Institute-wide badge award stats for the admin badges overview. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BadgeStatsResponseDTO {
    private long totalAwarded;
    private long learnersWithBadge;
    private List<BadgeStatDTO> badges;
}
