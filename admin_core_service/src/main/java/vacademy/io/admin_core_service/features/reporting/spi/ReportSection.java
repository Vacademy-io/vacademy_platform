package vacademy.io.admin_core_service.features.reporting.spi;

import java.util.Set;

/**
 * One pluggable section of a scheduled report.
 *
 * Spring collects every {@code @Component} implementation into
 * {@link ReportSectionRegistry} automatically — the same idiom as
 * {@code engagement.spi.DataPointRegistry}. Adding attendance reporting is ONE
 * new file and zero core edits; that is the whole point of the design.
 *
 * <h3>Failure contract — read this before implementing</h3>
 * {@link #compute} must <b>THROW</b> when a lookup fails, and return
 * {@code empty=true} only when the lookup succeeded and there is genuinely
 * nothing to say. Those two states must never collapse into one, for exactly the
 * reason the sibling engagement SPI states: "a 500 from a sibling service and
 * 'this learner has no data' must never become the same input to the model."
 * The learner chatbot shipped that bug — empty tool results read to the model as
 * "nothing exists" and it confabulated an answer. Do not repeat it here, where
 * the output is an email an institute owner will act on.
 */
public interface ReportSection {

    /** Stable key stored in REPORT_SETTING.schedules[].sections, e.g. "inactivity". */
    String key();

    /** Heading shown in the rendered document. */
    String title();

    /** One line explaining the section in the configuration screen. */
    String description();

    /**
     * Roles allowed to see this section. A schedule may list many recipients;
     * each one's document is rendered separately and a section they cannot see
     * is dropped from their copy. This is what stops a fees section reaching a
     * subject teacher because someone added them to the wrong schedule.
     */
    Set<String> visibleToRoles();

    /**
     * Does this section name individual learners? Sections that do can only be
     * sent to platform users — never to a typed-in email address — and every
     * such send is written to the audit log.
     */
    default boolean identifying() {
        return false;
    }

    /**
     * Does this institute have any data for this section in the recent past?
     *
     * Institutes have radically different shapes — one runs 1,573 live sessions
     * and no chatbot, another has 66,947 progress rows and one live session.
     * Asking an admin to tick boxes for sections that can never populate is a
     * bad first run, so the configuration screen only offers what returns true
     * here. Must be cheap: it runs once per section per config page load.
     */
    boolean isAvailableFor(String instituteId);

    /**
     * Compute the section. SQL only — no LLM, no cross-service calls that can
     * hang a scheduled job.
     *
     * @throws RuntimeException if the lookup could not be performed. Never
     *         return an empty result to signal failure.
     */
    SectionFacts compute(ReportContext ctx);

    /**
     * Scopes this section can genuinely differentiate.
     *
     * Declaring a scope it cannot honour is worse than not supporting it: the
     * runner would fan out to 50 batches and send 50 byte-identical institute-wide
     * documents — and, once billing lands, charge for all 50. The runner skips
     * combinations a section does not support rather than duplicating.
     */
    default Set<ReportContext.ScopeType> supportedScopes() {
        return Set.of(ReportContext.ScopeType.INSTITUTE);
    }

    /**
     * Relative credit weight, added to the base charge when this section is
     * included. Phase 0 does not bill; the value exists so the estimator has
     * something to sum once cost attribution is fixed.
     */
    default int creditWeight() {
        return 0;
    }
}
