package vacademy.io.admin_core_service.features.reporting.sections;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.reporting.spi.ReportContext;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What learners asked the AI assistant — and what it could not find for them.
 *
 * The companion to {@code DoubtsSection}: both answer "what are learners stuck
 * on", from the two channels they use. The assistant is by far the busier one
 * (one institute: 1,110 learners and 6,756 questions, against 31 open doubts), so
 * a digest that reports doubts and ignores this sees a small fraction of the
 * demand.
 *
 * <h3>The content gap is the point of this section</h3>
 * When the assistant needs course material it calls {@code
 * semantic_search_content}, and that tool writes a {@code tool_result} message
 * whose body is either the material or the literal string
 * {@code "No relevant content found for: '<query>'"}. Measured across prod it is
 * the second one essentially always — 577 of 577 calls overall, 399 of 404 at the
 * largest institute, 139 of 139 at the next. So the useful, institute-specific
 * output is not the failure rate but <b>the queries themselves</b>: they are a
 * ranked list of what learners tried to look up and the library could not answer.
 * That is a content backlog an admin can act on, and it is very often the thing
 * that then gets raised as a doubt and sits unanswered.
 *
 * <h3>Scoping</h3>
 * {@code chat_sessions.institute_id} is populated, so institute scoping is direct.
 * Batch and teacher-cohort scoping go through the asker's enrolment, the same path
 * {@code LearnerEngagementSection} uses — without that a teacher recipient would
 * see every cohort's questions.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AiAssistantSection implements ReportSection {

    /** Distinct unanswered searches listed, most-asked first. */
    private static final int MAX_ROWS = 15;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public String key() {
        return "ai_assistant";
    }

    @Override
    public String title() {
        return "AI assistant";
    }

    @Override
    public String description() {
        return "How much learners used the assistant, and the questions it could "
                + "not answer from your course material.";
    }

    @Override
    public Set<String> visibleToRoles() {
        return Set.of("ADMIN", "TEACHER");
    }

    @Override
    public boolean identifying() {
        // Rows are search phrases and counts — no learner is named. The phrases are
        // machine-generated from a learner's question, not their verbatim text.
        return false;
    }

    @Override
    public Set<ReportContext.ScopeType> supportedScopes() {
        return Set.of(ReportContext.ScopeType.INSTITUTE, ReportContext.ScopeType.BATCH);
    }

    @Override
    public int creditWeight() {
        return 1;
    }

    @Override
    public boolean isAvailableFor(String instituteId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM chat_sessions s "
                        + "WHERE s.institute_id = ? "
                        + "AND s.last_active > now() - INTERVAL '30 days'",
                Integer.class, instituteId);
        return n != null && n > 0;
    }

    @Override
    public SectionFacts compute(ReportContext ctx) {
        boolean batchScoped = ctx.getScopeType() == ReportContext.ScopeType.BATCH
                && ctx.getScopeId() != null;
        String batchId = batchScoped ? ctx.getScopeId() : null;

        boolean cohortRestricted = ctx.cohortRestricted();
        List<String> cohorts = cohortRestricted ? ctx.getVisibleCohortIds() : List.of();
        if (cohortRestricted && cohorts.isEmpty()) {
            return SectionFacts.builder()
                    .sectionKey(key()).title(title()).identifying(false).empty(true)
                    .build();
        }
        String cohortCsv = String.join(",", cohorts);

        Timestamp from = Timestamp.from(ctx.getWindowStart());
        Timestamp to = Timestamp.from(ctx.getWindowEnd());
        long span = ctx.getWindowEnd().toEpochMilli() - ctx.getWindowStart().toEpochMilli();
        Timestamp prevFrom = Timestamp.from(
                Instant.ofEpochMilli(ctx.getWindowStart().toEpochMilli() - span));

        Object[] scope = {ctx.getInstituteId(), batchScoped, batchId, cohortRestricted, cohortCsv};

        Map<String, Object> s = jdbcTemplate.queryForMap(SUMMARY_SQL,
                concat(scope, prevFrom, to, from, from, from, from, from));

        int learners = num(s.get("learners_now"));
        int learnersPrev = num(s.get("learners_prev"));
        int questions = num(s.get("questions"));
        int lookups = num(s.get("lookups"));
        int foundNothing = num(s.get("found_nothing"));

        List<SectionFacts.Row> rows = new ArrayList<>();
        int listed = 0;
        if (foundNothing > 0) {
            for (Map<String, Object> r : jdbcTemplate.queryForList(GAPS_SQL,
                    concat(scope, from, to, MAX_ROWS))) {
                int times = num(r.get("times"));
                listed += times;
                rows.add(SectionFacts.Row.builder()
                        .value(str(r.get("query"), "(unreadable search)"))
                        .value(times == 1 ? "once" : times + " times")
                        .build());
            }
            if (foundNothing > listed) {
                rows.add(SectionFacts.Row.builder()
                        .value((foundNothing - listed) + " further searches found nothing")
                        .value("")
                        .build());
            }
        }

        return SectionFacts.builder()
                .sectionKey(key())
                .title(title())
                .identifying(false)
                .empty(questions == 0 && learnersPrev == 0)
                .headline("Learners who asked", String.valueOf(learners))
                .headline("vs previous period", describeDelta(learners, learnersPrev))
                .headline("Questions asked", String.valueOf(questions))
                .headline("Material lookups", lookups == 0
                        ? "0" : foundNothing + " of " + lookups + " found nothing")
                .column("Learners looked for")
                .column("Asked")
                .rows(rows)
                .build();
    }

    private static Object[] concat(Object[] head, Object... tail) {
        Object[] out = new Object[head.length + tail.length];
        System.arraycopy(head, 0, out, 0, head.length);
        System.arraycopy(tail, 0, out, head.length, tail.length);
        return out;
    }

    private static String describeDelta(int now, int before) {
        if (before <= 0) return now > 0 ? "first use" : "—";
        long pct = Math.round(100.0 * (now - before) / before);
        if (pct == 0) return "unchanged";
        return (pct > 0 ? "+" : "") + pct + "%";
    }

    private static int num(Object o) {
        return o == null ? 0 : ((Number) o).intValue();
    }

    private static String str(Object o, String fallback) {
        String v = o == null ? null : String.valueOf(o).trim();
        return (v == null || v.isEmpty()) ? fallback : v;
    }

    /**
     * Chat sessions for this institute, optionally narrowed to a batch and to the
     * reader's own cohorts via the asker's enrolment.
     *
     * Params: instituteId, batchScoped, batchId, cohortRestricted, cohortCsv.
     */
    private static final String SESSION_CTE = """
            WITH sess AS (
                SELECT s.id, s.user_id
                FROM chat_sessions s
                WHERE s.institute_id = ?
                  AND (NOT CAST(? AS boolean) OR EXISTS (
                        SELECT 1 FROM student_session_institute_group_mapping mb
                        WHERE mb.user_id = s.user_id AND mb.status = 'ACTIVE'
                          AND mb.package_session_id = ?))
                  AND (NOT CAST(? AS boolean) OR EXISTS (
                        SELECT 1 FROM student_session_institute_group_mapping mc
                        WHERE mc.user_id = s.user_id AND mc.status = 'ACTIVE'
                          AND mc.package_session_id
                              = ANY (string_to_array(?, ','))))
            )
            """;

    /**
     * Messages are read once across both windows and split with FILTERs, so the
     * period comparison costs one pass rather than two.
     *
     * Params: SESSION_CTE params, prevStart, windowEnd, then windowStart five times.
     */
    private static final String SUMMARY_SQL = SESSION_CTE + """
            , msg AS (
                SELECT s.user_id, m.message_type, m.metadata, m.content, m.created_at
                FROM sess s
                JOIN chat_messages m ON m.session_id = s.id
                WHERE m.created_at >= ? AND m.created_at < ?
            )
            SELECT count(DISTINCT user_id) FILTER (WHERE created_at >= ?) AS learners_now,
                   count(DISTINCT user_id) FILTER (WHERE created_at <  ?) AS learners_prev,
                   count(*) FILTER (WHERE message_type = 'user'
                                      AND created_at >= ?) AS questions,
                   count(*) FILTER (WHERE message_type = 'tool_result'
                                      AND metadata->>'tool_name' = 'semantic_search_content'
                                      AND created_at >= ?) AS lookups,
                   count(*) FILTER (WHERE message_type = 'tool_result'
                                      AND metadata->>'tool_name' = 'semantic_search_content'
                                      AND content LIKE 'No relevant content found%'
                                      AND created_at >= ?) AS found_nothing
            FROM msg
            """;

    /**
     * The content backlog: what learners searched for that the library could not
     * answer, most-asked first.
     *
     * The query is recovered from the tool's own message body, which has the fixed
     * shape {@code No relevant content found for: '<query>'}. Rows whose body does
     * not match that shape yield null and are dropped rather than shown raw.
     *
     * Params: SESSION_CTE params, windowStart, windowEnd, limit.
     */
    private static final String GAPS_SQL = SESSION_CTE + """
            SELECT lower(btrim(q.query)) AS query, count(*) AS times
            FROM sess s
            JOIN chat_messages m ON m.session_id = s.id
            CROSS JOIN LATERAL (
                SELECT substring(m.content
                                 from 'No relevant content found for: ''(.*)''') AS query
            ) q
            WHERE m.message_type = 'tool_result'
              AND m.metadata->>'tool_name' = 'semantic_search_content'
              AND m.content LIKE 'No relevant content found%'
              AND m.created_at >= ? AND m.created_at < ?
              AND q.query IS NOT NULL AND btrim(q.query) <> ''
            GROUP BY 1
            ORDER BY times DESC, query
            LIMIT ?
            """;
}
