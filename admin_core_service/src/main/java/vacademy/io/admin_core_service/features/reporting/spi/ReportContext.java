package vacademy.io.admin_core_service.features.reporting.spi;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

/**
 * Everything a {@link ReportSection} needs to compute one document.
 *
 * A context describes ONE rendered document, not one schedule: a subject-scoped
 * schedule across 30 subjects produces 30 contexts (and, once Phase 2 wires
 * billing, 30 charges). Keeping the scope inside the context is what lets a
 * section stay ignorant of how the fan-out was decided.
 *
 * Window boundaries are computed in the institute's own zone and then stored as
 * instants. The admin_core JVM runs UTC and must keep running UTC — resolving
 * "last week" against the server zone would silently shift every window by 5.5
 * hours for an Indian institute.
 */
@Getter
@Builder(toBuilder = true)
public class ReportContext {

    private final String instituteId;

    /** Zone the window boundaries were computed in, e.g. Asia/Kolkata. */
    private final ZoneId zone;

    /** Inclusive start of the reporting window. */
    private final Instant windowStart;

    /** Exclusive end of the reporting window. */
    private final Instant windowEnd;

    /** INSTITUTE | BATCH | SUBJECT | FACULTY. Phase 0 only emits INSTITUTE. */
    private final ScopeType scopeType;

    /**
     * The scoped entity this document covers — a package_session id for BATCH,
     * subject id for SUBJECT, user id for FACULTY. Null for INSTITUTE.
     */
    private final String scopeId;

    /** Human label for the scope, used in the subject line and heading. */
    private final String scopeLabel;

    /** "daily" | "weekly" | "monthly" — how often this reader hears from us. */
    private final String cadence;

    /**
     * When this schedule last successfully reported on this scope, or null on the
     * first ever run.
     *
     * Exists so a section can distinguish "the state of things" from "what changed
     * since you last heard from us". Sections that report a STANDING BACKLOG must
     * use it, because a backlog is identical tomorrow: measured on real data, a
     * daily doubts report showed the same twelve 120-to-160-day-old doubts every
     * day while the eight raised that week ranked 25th and below and were never
     * shown at all. A daily reader needs the day's news; a weekly reader is the one
     * who benefits from being reminded of the worst of the backlog.
     */
    private final Instant previousRunAt;

    /** True when this reader has heard from us before about this scope. */
    public boolean hasPreviousRun() {
        return previousRunAt != null;
    }

    /** Daily readers get "what changed"; longer cadences get "how things stand". */
    public boolean isDailyCadence() {
        return cadence != null && cadence.equalsIgnoreCase("daily");
    }

    /**
     * Learner ids this document is allowed to name, or null for "no restriction".
     *
     * This is how the teacher-scoping rule is enforced: a TEACHER recipient is
     * hard-limited to their own cohorts server-side, and a schedule cannot
     * override it. Sections MUST intersect against this before naming anyone.
     */
    private final List<String> visibleLearnerIds;

    /**
     * Cohorts (package_session ids) this document may describe, or null for all.
     *
     * The learner-id list above only scopes sections that name people. A section
     * whose rows are CLASSES passes a learner filter untouched, so without this a
     * teacher would be emailed every colleague's attendance. EMPTY means "may
     * describe no cohort" and must stay distinct from null, exactly as above.
     */
    private final List<String> visibleCohortIds;

    public enum ScopeType { INSTITUTE, BATCH, SUBJECT, FACULTY }

    public boolean cohortRestricted() {
        return visibleCohortIds != null;
    }

    public boolean namingRestricted() {
        return visibleLearnerIds != null;
    }
}
