package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BadgeStatDTO {
    private String badgeId;
    private String badgeName;
    private String badgeIcon;
    private long count;
}
