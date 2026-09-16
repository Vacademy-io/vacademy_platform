package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** The learner's "today" payload across every batch they belong to. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EngagementFeedDTO {
    /** Items openable right now (or catchable), already capped and ordered. */
    private List<EngagementItemDTO> items;
    /** Locked future items — metadata only. */
    private List<EngagementItemDTO> upcoming;
    private int totalToday;
    private int completedToday;
    /** True when the cap hid additional items; they are NOT counted as missed. */
    private boolean capApplied;
}
