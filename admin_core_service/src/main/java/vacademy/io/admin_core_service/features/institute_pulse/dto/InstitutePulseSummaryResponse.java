package vacademy.io.admin_core_service.features.institute_pulse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Institute-wide presence KPIs plus a capped, needs-attention-ordered roster. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstitutePulseSummaryResponse {

    private Counts counts;

    private List<RosterRow> roster;

    private int returned;

    private int totalPresent;

    /** 0-based index of the roster page. */
    private int page;

    /** True when more present learners exist beyond this page. */
    private boolean hasMore;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Counts {
        private long active;
        private long idle;
        private long needHelp;
        private long enrolled;
        private long offline;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RosterRow {
        private String userId;
        private String fullName;
        private String slideId;
        private String slideTitle;
        private String slideType;
        private long onSlideSeconds;
        /** ACTIVE, IDLE or NEEDS_HELP. */
        private String state;
    }
}
