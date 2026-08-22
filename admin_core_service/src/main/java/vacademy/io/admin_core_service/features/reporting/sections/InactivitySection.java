package vacademy.io.admin_core_service.features.reporting.sections;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.reporting.spi.ReportContext;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Learners who have gone quiet.
 *
 * Chosen as the first section deliberately: it is the most actionable thing in
 * the dataset, it works for every institute regardless of shape (learning
 * progress is the one signal present almost everywhere — 48.5k rows across 1,718
 * learners in a 30-day sample), and it is useful with no AI at all, which is what
 * an unbilled Phase 0 needs to prove.
 *
 * <h3>Query shape and why</h3>
 * The scan is bounded three ways because an unbounded analytics query on the
 * primary has taken this database down before: enrolled learners are resolved
 * first via {@code idx_ssigm_institute_id_status}, learner_operation is only
 * consulted inside a 90-day window using {@code idx_learner_operation_user_operation},
 * and the detail list is capped. Measured on the largest institute (8,226 active
 * learners): 151ms, entirely from shared buffers, 465kB peak aggregate memory.
 *
 * A learner with no rows at all is still counted — an inner join would hide them
 * entirely — but they are reported SEPARATELY and never named.
 *
 * <h3>Why "never started" and "went quiet" are split</h3>
 * Measured at the largest institute: of 7,064 enrolled learners, 4,800 have never
 * had a single activity row and 1,906 were active and then stopped. Reporting one
 * combined "quiet" number produces 6,706 — 95% of the roll — and a named list
 * dominated by people who never began, which an admin already knows and cannot act
 * on. The recoverable cohort is the 1,906, so those are the ones named, ordered by
 * most recently lapsed: someone who stopped last week is far more reachable than
 * someone who stopped in March.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class InactivitySection implements ReportSection {

    private static final int INACTIVE_DAYS = 7;
    private static final int LOOKBACK_DAYS = 90;
    /**
     * How many named rows compute() returns. Deliberately larger than a report
     * shows: the per-recipient cohort filter runs downstream, so truncating to the
     * display size here would let a teacher whose learners are outside the
     * institute-wide top slice be told they have none. Display truncation happens
     * after filtering.
     */
    private static final int MAX_COMPUTED = 400;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public Set<ReportContext.ScopeType> supportedScopes() {
        // BATCH is a real filter here (package_session_id on the enrolment row).
        // SUBJECT and FACULTY are not expressible against learner_operation, so they
        // are excluded rather than silently producing duplicate institute reports.
        return Set.of(ReportContext.ScopeType.INSTITUTE, ReportContext.ScopeType.BATCH);
    }

    @Override
    public String key() {
        return "inactivity";
    }

    @Override
    public String title() {
        return "Learners who have gone quiet";
    }

    @Override
    public String description() {
        return "Learners who were active and have now stopped for " + INACTIVE_DAYS
                + "+ days, most recently lapsed first. Counts learners who never "
                + "started separately — they are a different problem.";
    }

    @Override
    public Set<String> visibleToRoles() {
        return Set.of("ADMIN", "TEACHER");
    }

    @Override
    public boolean identifying() {
        return true; // names learners — platform-user recipients only, and audited
    }


    @Override
    public boolean isAvailableFor(String instituteId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM student_session_institute_group_mapping "
                        + "WHERE institute_id = ? AND status = 'ACTIVE'",
                Integer.class, instituteId);
        return n != null && n > 0;
    }

    @Override
    public SectionFacts compute(ReportContext ctx) {
        // Deliberately NOT wrapped in try/catch. A failure here must propagate so
        // the run is marked failed and the section is reported as unavailable —
        // never rendered as "0 inactive learners", which reads as good news.
        boolean batchScoped = ctx.getScopeType() == ReportContext.ScopeType.BATCH
                && ctx.getScopeId() != null;
        String batchId = batchScoped ? ctx.getScopeId() : null;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(SQL,
                ctx.getInstituteId(), batchScoped, batchId,
                ctx.getInstituteId(), batchScoped, batchId,
                LOOKBACK_DAYS);

        int activeLearners = 0;
        int neverStarted = 0, activeThisWeek = 0;
        int lapsed7 = 0, lapsed30 = 0;
        List<SectionFacts.Row> detail = new ArrayList<>();
        Instant now = Instant.now();

        for (Map<String, Object> r : rows) {
            activeLearners++;
            String userId = (String) r.get("user_id");
            Timestamp lastSeenTs = (Timestamp) r.get("last_seen");
            Long ops30 = r.get("ops_30d") == null ? 0L : ((Number) r.get("ops_30d")).longValue();

            if (lastSeenTs == null) {
                // Never began. Counted, never named — a 4,800-name list of people
                // who never started is not something an admin can act on.
                neverStarted++;
                continue;
            }

            long daysQuiet = Duration.between(lastSeenTs.toInstant(), now).toDays();
            if (daysQuiet < INACTIVE_DAYS) {
                activeThisWeek++;
                continue;
            }
            lapsed7++;
            if (daysQuiet >= 30) lapsed30++;

            // Teacher recipients only ever see their own cohorts. Enforced here,
            // server-side, so a mis-configured schedule cannot widen it.
            if (ctx.namingRestricted() && !ctx.getVisibleLearnerIds().contains(userId)) continue;
            if (detail.size() >= MAX_COMPUTED) continue;

            detail.add(SectionFacts.Row.builder()
                    .subjectId(userId)
                    .value(str(r.get("full_name"), "(unnamed learner)"))
                    .value(daysQuiet + " days ago")
                    .value(String.valueOf(ops30))
                    .build());
        }

        boolean nothingToSay = lapsed7 == 0;

        return SectionFacts.builder()
                .sectionKey(key())
                .title(title())
                .identifying(true)
                .empty(nothingToSay)
                .headline("Enrolled", String.valueOf(activeLearners))
                .headline("Active this week", String.valueOf(activeThisWeek))
                .headline("Went quiet", String.valueOf(lapsed7))
                .headline("Quiet 30+ days", String.valueOf(lapsed30))
                .headline("Never started", String.valueOf(neverStarted))
                .column("Learner")
                .column("Stopped")
                .column("Activity before stopping")
                .rows(detail)
                .build();
    }

    private static String str(Object o, String fallback) {
        String s = o == null ? null : String.valueOf(o).trim();
        return (s == null || s.isEmpty()) ? fallback : s;
    }

    /**
     * Enrolled learners left-joined to a bounded slice of their activity.
     * Parameters: instituteId (twice — once per CTE), lookback days.
     */
    private static final String SQL = """
            WITH active AS (
                SELECT m.user_id
                FROM student_session_institute_group_mapping m
                WHERE m.institute_id = ? AND m.status = 'ACTIVE'
                  AND (NOT CAST(? AS boolean) OR m.package_session_id = ?)
                GROUP BY m.user_id
            ),
            seen AS (
                SELECT lo.user_id,
                       MAX(lo.created_at) AS last_seen,
                       COUNT(*) FILTER (WHERE lo.created_at > now() - INTERVAL '30 days') AS ops_30d
                FROM learner_operation lo
                WHERE lo.user_id IN (
                        SELECT m.user_id FROM student_session_institute_group_mapping m
                        WHERE m.institute_id = ? AND m.status = 'ACTIVE'
                          AND (NOT CAST(? AS boolean) OR m.package_session_id = ?))
                  AND lo.created_at > now() - make_interval(days => ?)
                GROUP BY lo.user_id
            )
            SELECT a.user_id,
                   s.full_name,
                   sn.last_seen,
                   COALESCE(sn.ops_30d, 0) AS ops_30d
            FROM active a
            LEFT JOIN seen sn ON sn.user_id = a.user_id
            LEFT JOIN LATERAL (
                SELECT st.full_name FROM student st
                WHERE st.user_id = a.user_id
                ORDER BY st.created_at DESC NULLS LAST
                LIMIT 1
            ) s ON TRUE
            ORDER BY sn.last_seen DESC NULLS LAST
            """;
}
