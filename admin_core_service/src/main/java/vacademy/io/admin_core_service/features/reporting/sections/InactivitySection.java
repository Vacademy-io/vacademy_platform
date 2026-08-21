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
 * A learner with no rows at all is the MOST inactive, not the least — hence the
 * left join and {@code NULLS FIRST}. An inner join would silently hide exactly
 * the people this section exists to surface.
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
        return "Enrolled learners with no activity in the last " + INACTIVE_DAYS
                + " days, and how engaged they were before they stopped.";
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
    public int creditWeight() {
        return 1;
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
        int inactive7 = 0, inactive14 = 0, inactive30 = 0;
        List<SectionFacts.Row> detail = new ArrayList<>();
        Instant now = Instant.now();

        for (Map<String, Object> r : rows) {
            activeLearners++;
            String userId = (String) r.get("user_id");
            Timestamp lastSeenTs = (Timestamp) r.get("last_seen");
            Long ops30 = r.get("ops_30d") == null ? 0L : ((Number) r.get("ops_30d")).longValue();

            long daysQuiet = lastSeenTs == null
                    ? Long.MAX_VALUE
                    : Duration.between(lastSeenTs.toInstant(), now).toDays();

            if (daysQuiet >= 30) inactive30++;
            if (daysQuiet >= 14) inactive14++;
            if (daysQuiet < INACTIVE_DAYS) continue;
            inactive7++;

            // Teacher recipients only ever see their own cohorts. Enforced here,
            // server-side, so a mis-configured schedule cannot widen it.
            if (ctx.namingRestricted() && !ctx.getVisibleLearnerIds().contains(userId)) continue;
            if (detail.size() >= MAX_COMPUTED) continue;

            detail.add(SectionFacts.Row.builder()
                    .subjectId(userId)
                    .value(str(r.get("full_name"), "(unnamed learner)"))
                    .value(daysQuiet == Long.MAX_VALUE ? "never active" : daysQuiet + " days ago")
                    .value(String.valueOf(ops30))
                    .build());
        }

        boolean nothingToSay = inactive7 == 0;

        return SectionFacts.builder()
                .sectionKey(key())
                .title(title())
                .identifying(true)
                .empty(nothingToSay)
                .headline("Enrolled learners", String.valueOf(activeLearners))
                .headline("Quiet " + INACTIVE_DAYS + "+ days", String.valueOf(inactive7))
                .headline("Quiet 14+ days", String.valueOf(inactive14))
                .headline("Quiet 30+ days", String.valueOf(inactive30))
                .column("Learner")
                .column("Last active")
                .column("Activity in last 30d")
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
            ORDER BY sn.last_seen ASC NULLS FIRST
            """;
}
