package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** The learner's "today" payload across every batch they belong to. */
@Data
@NoArgsConstructor
public class EngagementFeedDTO {

    public EngagementFeedDTO(List<EngagementItemDTO> items, List<EngagementItemDTO> upcoming,
                             int totalToday, int completedToday, boolean capApplied) {
        this.items = items;
        this.upcoming = upcoming;
        this.totalToday = totalToday;
        this.completedToday = completedToday;
        this.capApplied = capApplied;
        this.revealed = List.of();
        this.streakDays = 0;
    }

    /** Items openable right now (or catchable), already capped and ordered. */
    private List<EngagementItemDTO> items;
    /** Locked future items — metadata only. */
    private List<EngagementItemDTO> upcoming;
    private int totalToday;
    private int completedToday;
    /** True when the cap hid additional items; they are NOT counted as missed. */
    private boolean capApplied;
    /**
     * Recently revealed tasks the learner completed — the "here's the answer"
     * moment. Carries the key, the explanation and how the learner did.
     */
    private List<EngagementItemDTO> revealed;
    /** Consecutive days (institute-local) ending today or yesterday with a completion. */
    private int streakDays;
}
