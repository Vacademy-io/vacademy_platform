package vacademy.io.admin_core_service.features.reporting.spi;

import lombok.Builder;
import lombok.Getter;
import lombok.Singular;

import java.util.List;
import java.util.Map;

/**
 * What one section computed. Deterministic, SQL-derived, and the ONLY thing a
 * narrator is ever allowed to see.
 *
 * The hard rule of this system lives here: every number a recipient reads comes
 * out of {@link #headlines} or {@link #rows}, computed in SQL. When the AI layer
 * arrives in Phase 2 it receives an instance of this class and writes prose
 * about it — it never recomputes, and it never invents a figure. A model that is
 * allowed to do arithmetic will eventually email an institute owner a confidently
 * wrong completion rate.
 */
@Getter
@Builder
public class SectionFacts {

    private final String sectionKey;
    private final String title;

    /**
     * Ordered headline metrics: label → already-formatted value ("78%", "808").
     * Formatting happens here rather than in the renderer so a section owns how
     * its own numbers read.
     */
    @Singular("headline")
    private final Map<String, String> headlines;

    /** Optional detail table. Empty for sections that are headline-only. */
    @Singular
    private final List<Row> rows;

    /** Column headers for {@link #rows}, in order. */
    @Singular("column")
    private final List<String> columns;

    /**
     * True when the section ran successfully and there is genuinely nothing to
     * report. Distinct from a failure — a failing section THROWS.
     *
     * A run where every section is empty is skipped entirely and, once billing
     * exists, must not charge: an institute that bleeds credits to be told
     * "nothing happened" will turn reports off and resent them.
     */
    private final boolean empty;

    /** Does this section name individual learners? Drives recipient restrictions. */
    private final boolean identifying;

    /** One detail line. Values are pre-formatted and positionally match columns. */
    @Getter
    @Builder
    public static class Row {
        @Singular("value")
        private final List<String> values;

        /** Learner id when the row is about a person — used for scope filtering. */
        private final String subjectId;
    }
}
