package vacademy.io.admin_core_service.features.course_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The Roster tab's single poll payload: exact KPI counts (over the whole batch) plus the
 * capped, needs-attention-ordered roster. Counts are always full; the roster is limited,
 * so the response size is bounded regardless of batch size.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PulseSummaryResponse {

    private Counts counts;
    private List<PulseRosterRow> roster;

    /** rows actually returned (<= limit). */
    private int returned;

    /** active + idle across the whole batch (may exceed {@code returned}). */
    private int totalPresent;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Counts {
        private long active;
        private long idle;
        private long offline;
        private long needHelp;
        private long enrolled;
    }
}
