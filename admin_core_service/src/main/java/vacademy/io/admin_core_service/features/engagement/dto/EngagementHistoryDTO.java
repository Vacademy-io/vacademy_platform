package vacademy.io.admin_core_service.features.engagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The learner's past tasks: every occurrence that has already run, newest first.
 *
 * Each entry is an {@link EngagementItemDTO} with {@code historyStatus} set —
 * DONE, MISSED, or CATCH_UP (missed, but still openable for reduced points).
 * Today's still-open tasks are NOT here; they belong on the home card.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EngagementHistoryDTO {
    private String from;
    private String to;
    private List<EngagementItemDTO> items;
    private int done;
    /** Closed occurrences that can no longer be done. */
    private int missed;
    /** Missed but still inside the catch-up window. */
    private int catchUp;
    private int pointsEarned;
}
