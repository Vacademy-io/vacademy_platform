package vacademy.io.admin_core_service.features.learner_badge.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A learner app's report of the badges it has auto-unlocked (computed client-side).
 * The learner is always taken from the JWT — never from this body — so it cannot claim
 * unlocks for another user. Each entry snapshots the badge's presentation at sync time.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SyncUnlocksRequest {

    @NotBlank(message = "instituteId is required")
    private String instituteId;

    private List<UnlockedBadge> badges;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnlockedBadge {
        private String badgeId;
        private String badgeName;
        private String badgeIcon;
        private String badgeDescription;
    }
}
