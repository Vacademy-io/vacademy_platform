package vacademy.io.admin_core_service.features.reporting.sections;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.reporting.spi.ReportContext;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;
import vacademy.io.admin_core_service.features.reporting.spi.SectionFacts;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What learners said about the live classes.
 *
 * The counterpart to {@code LiveAttendanceSection}: that one says who turned up,
 * this one says whether it was worth turning up for. Same {@code
 * live_session_logs} table, {@code log_type = 'FEEDBACK_SUBMITTED'}, joined to
 * occurrences by {@code schedule_id} (populated on all 5,554 rows).
 *
 * <h3>What a feedback row holds</h3>
 * {@code details} is JSON in a TEXT column with up to four keys: {@code rating}
 * (5,553 rows), {@code feedback} (689), {@code learnings} (479) and {@code doubts}
 * (376). Ratings run 0.5 to 5 in half steps.
 *
 * <h3>Why the average is not the headline finding</h3>
 * 67% of all ratings are a flat 5, so an institute average sits near 4.6 and moves
 * almost never — reporting it alone would be a number that is always fine. The
 * signal is in the tail, so the rows rank classes by WORST average and carry the
 * learner's own words, and those words are consistently more useful than the
 * score: the comments under low ratings are "lagging", "network issue", "can not
 * hear" — streaming faults, not teaching faults, and an admin can act on that the
 * same day.
 *
 * <h3>The doubts key is a second, invisible doubt channel</h3>
 * 376 feedback submissions carry a written doubt. Those live here, in a session
 * log, and not in the {@code doubts} table that {@code DoubtsSection} reports on —
 * so an institute working only its doubt queue never sees them. They are counted
 * here for that reason.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SessionFeedbackSection implements ReportSection {

    /** Classes ranked by average. Sized with the voices below for the 25-row budget. */
    private static final int MAX_RANKED_ROWS = 8;
    /** Individual low ratings that came with a written comment. */
    private static final int MAX_VOICE_ROWS = 6;
    /**
     * Below this many responses a class average is one person's opinion wearing a
     * cohort's clothes. Measured: 20 of the 27 low-rated classes in a month had
     * exactly ONE response, so ranking without this floor reports individual
     * annoyance as class quality.
     */
    private static final int MIN_RESPONSES_TO_RANK = 2;
    /** At or below this, a class needs looking at. */
    private static final double LOW_RATING = 2.5;
    /** Comment length in the table. Average is 32 chars; the longest is 555. */
    private static final int COMMENT_CHARS = 80;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public String key() {
        return "session_feedback";
    }

    @Override
    public String title() {
        return "Class feedback";
    }

    @Override
    public String description() {
        return "Ratings learners gave the live classes, worst first, with what "
                + "they wrote — and any doubts raised through feedback.";
    }

    @Override
    public Set<String> visibleToRoles() {
        return Set.of("ADMIN", "TEACHER");
    }

    @Override
    public boolean identifying() {
        // Ratings and comments are reported unattributed — no learner is named.
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
                "SELECT COUNT(*) FROM live_session_logs l "
                        + "JOIN live_session ls ON ls.id = l.session_id "
                        + "WHERE ls.institute_id = ? "
                        + "AND l.log_type = 'FEEDBACK_SUBMITTED' "
                        + "AND l.created_at > now() - INTERVAL '30 days'",
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

        Object[] scope = {ctx.getInstituteId(),
                Timestamp.from(ctx.getWindowStart()), Timestamp.from(ctx.getWindowEnd()),
                batchScoped, batchId, cohortRestricted, cohortCsv};

        Map<String, Object> s = jdbcTemplate.queryForMap(SUMMARY_SQL,
                concat(scope, LOW_RATING, MIN_RESPONSES_TO_RANK));

        int responses = num(s.get("responses"));
        int low = num(s.get("low_ratings"));
        int withDoubt = num(s.get("with_doubt"));
        Object avg = s.get("avg_rating");

        List<SectionFacts.Row> rows = new ArrayList<>();

        // Classes with enough responses to be judged as classes.
        for (Map<String, Object> r : jdbcTemplate.queryForList(RANKED_SQL,
                concat(scope, COMMENT_CHARS, MIN_RESPONSES_TO_RANK, MAX_RANKED_ROWS))) {
            int n = num(r.get("responses"));
            Object classAvg = r.get("avg_rating");
            rows.add(SectionFacts.Row.builder()
                    .value(str(r.get("title"), "(untitled class)"))
                    .value(String.valueOf(r.get("day")))
                    .value((classAvg == null ? "—" : fmtRating(classAvg))
                            + " · " + (n == 1 ? "1 response" : n + " responses"))
                    .value(str(r.get("comment"), "—"))
                    .build());
        }
        int rankedListed = rows.size();

        // Then the individual complaints. One learner rating a class 0.5 is not a
        // verdict on the class, but "lagging" or "can not hear" is still a fault
        // worth an admin's morning — so they appear as voices, not as rankings.
        List<Map<String, Object>> voices = jdbcTemplate.queryForList(VOICES_SQL,
                concat(scope, COMMENT_CHARS, LOW_RATING, MAX_VOICE_ROWS));
        for (Map<String, Object> r : voices) {
            rows.add(SectionFacts.Row.builder()
                    .value(str(r.get("title"), "(untitled class)"))
                    .value(String.valueOf(r.get("day")))
                    .value(fmtRating(r.get("rating")) + " · one learner")
                    .value(str(r.get("comment"), "—"))
                    .build());
        }

        int totalClasses = num(s.get("classes"));
        int rankable = num(s.get("rankable_classes"));
        if (rankable > rankedListed && rankedListed > 0) {
            rows.add(SectionFacts.Row.builder()
                    .value((rankable - rankedListed) + " further classes rated higher")
                    .value("").value("").value("")
                    .build());
        }

        SectionFacts.SectionFactsBuilder facts = SectionFacts.builder()
                .sectionKey(key())
                .title(title())
                .identifying(false)
                .empty(responses == 0)
                // Deliberately NOT expressed as a share of attendees. Attendance is
                // frequently never captured (see LiveAttendanceSection), so that
                // denominator is unsound — measured here it produced "1,261 responses
                // of 839 who attended", a 150% response rate.
                .headline("Responses", String.valueOf(responses))
                .headline("Classes rated", String.valueOf(totalClasses))
                .headline("Average rating", avg == null ? "—" : fmtRating(avg) + " of 5")
                .headline("Rated " + trimNumber(LOW_RATING) + " or below", String.valueOf(low));

        // Only mention the hidden channel when it actually has something in it.
        if (withDoubt > 0) {
            facts.headline("Doubts raised in feedback", String.valueOf(withDoubt));
        }

        return facts
                .column("Class")
                .column("Held")
                .column("Rating")
                .column("What learners wrote")
                .rows(rows)
                .build();
    }

    private static Object[] concat(Object[] head, Object... tail) {
        Object[] out = new Object[head.length + tail.length];
        System.arraycopy(head, 0, out, 0, head.length);
        System.arraycopy(tail, 0, out, head.length, tail.length);
        return out;
    }

    /** 4.5 not 4.50, and 5 not 5.0 — a rating reads as a rating. */
    private static String fmtRating(Object o) {
        double d = ((Number) o).doubleValue();
        return trimNumber(Math.round(d * 10) / 10.0);
    }

    private static String trimNumber(double d) {
        return d == Math.rint(d)
                ? String.valueOf((long) d)
                : String.valueOf(d);
    }

    private static int num(Object o) {
        return o == null ? 0 : ((Number) o).intValue();
    }

    private static String str(Object o, String fallback) {
        String v = o == null ? null : String.valueOf(o).trim();
        return (v == null || v.isEmpty()) ? fallback : v;
    }

    /**
     * Feedback rows for this institute in the window, optionally narrowed to a
     * batch and to the reader's own cohorts.
     *
     * {@code details} is JSON held in a TEXT column, so it is cast per row. Every
     * row in prod parses; a row that did not would fail the section, which is the
     * intended contract — a section reports or throws, it never half-reports.
     *
     * Params: instituteId, windowStart, windowEnd, batchScoped, batchId,
     * cohortRestricted, cohortCsv.
     */
    private static final String FEEDBACK_CTE = """
            WITH fb AS (
                SELECT l.schedule_id, l.session_id, ls.title, l.created_at,
                       (l.details::jsonb->>'rating')::numeric      AS rating,
                       btrim(COALESCE(l.details::jsonb->>'feedback', '')) AS comment,
                       btrim(COALESCE(l.details::jsonb->>'doubts', ''))   AS doubt
                FROM live_session_logs l
                JOIN live_session ls ON ls.id = l.session_id
                WHERE ls.institute_id = ?
                  AND l.log_type = 'FEEDBACK_SUBMITTED'
                  AND l.created_at >= ? AND l.created_at < ?
                  AND (NOT CAST(? AS boolean) OR EXISTS (
                        SELECT 1 FROM live_session_participants p
                        WHERE p.session_id = ls.id
                          AND p.source_type = 'BATCH' AND p.source_id = ?))
                  AND (NOT CAST(? AS boolean) OR EXISTS (
                        SELECT 1 FROM live_session_participants pc
                        WHERE pc.session_id = ls.id
                          AND pc.source_type = 'BATCH'
                          AND pc.source_id = ANY (string_to_array(?, ','))))
            )
            """;

    /** Params: FEEDBACK_CTE params, lowRatingThreshold, minResponsesToRank. */
    private static final String SUMMARY_SQL = FEEDBACK_CTE + """
            SELECT count(*)                                   AS responses,
                   count(DISTINCT schedule_id)                AS classes,
                   round(avg(rating), 2)                      AS avg_rating,
                   count(*) FILTER (WHERE rating <= ?)        AS low_ratings,
                   count(*) FILTER (WHERE doubt <> '')        AS with_doubt,
                   (SELECT count(*) FROM (
                        SELECT schedule_id FROM fb
                        GROUP BY schedule_id HAVING count(*) >= ?) r) AS rankable_classes
            FROM fb
            """;

    /**
     * One row per class that has enough responses to be judged as a class.
     *
     * The comment shown is the one attached to that class's LOWEST rating, because
     * the complaint explains the score in a way the score cannot explain itself.
     * Whitespace is collapsed and any stray tag stripped before truncation — the
     * text is learner-written, and although no feedback row in prod carries markup
     * today, one row in {@code learnings} already does.
     *
     * Params: FEEDBACK_CTE params, commentChars, minResponses, limit.
     */
    private static final String RANKED_SQL = FEEDBACK_CTE + """
            SELECT title,
                   max(created_at)::date       AS day,
                   count(*)                    AS responses,
                   round(avg(rating), 2)       AS avg_rating,
                   left(
                     (array_agg(
                        btrim(regexp_replace(regexp_replace(comment, '<[^>]*>', ' ', 'g'),
                                             '\\s+', ' ', 'g'))
                        ORDER BY rating ASC NULLS LAST, created_at DESC)
                      FILTER (WHERE comment <> ''))[1], ?) AS comment
            FROM fb
            GROUP BY schedule_id, title
            HAVING count(*) >= ?
            -- Worst first; then the classes where learners actually said why,
            -- because a bare 0.5 cannot be acted on and "lagging" can.
            ORDER BY avg(rating) ASC NULLS LAST,
                     count(*) FILTER (WHERE comment <> '') DESC,
                     count(*) DESC
            LIMIT ?
            """;

    /**
     * Individual low ratings that came with a written comment.
     *
     * These are deliberately NOT ranked as class quality — a single 0.5 is one
     * learner's experience, and 20 of the 27 low-rated classes in a measured month
     * had exactly one response. But the words are actionable even when the score is
     * not, so they are surfaced as voices and labelled "one learner" so no reader
     * mistakes them for a verdict.
     *
     * Params: FEEDBACK_CTE params, commentChars, lowRating, limit.
     */
    private static final String VOICES_SQL = FEEDBACK_CTE + """
            SELECT f.title,
                   f.created_at::date AS day,
                   f.rating,
                   left(btrim(regexp_replace(
                       regexp_replace(f.comment, '<[^>]*>', ' ', 'g'),
                       '\\s+', ' ', 'g')), ?) AS comment
            FROM fb f
            JOIN (SELECT schedule_id FROM fb
                  GROUP BY schedule_id HAVING count(*) = 1) single
              ON single.schedule_id = f.schedule_id
            WHERE f.rating <= ?
              AND f.comment <> ''
            ORDER BY f.rating ASC, f.created_at DESC
            LIMIT ?
            """;
}
