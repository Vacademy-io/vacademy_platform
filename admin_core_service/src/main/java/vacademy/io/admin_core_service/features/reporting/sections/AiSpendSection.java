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
 * Where the institute's AI credits went.
 *
 * Self-referential on purpose: an institute that cannot see what it spends
 * credits on has no basis to buy more, and no way to notice a feature quietly
 * burning them. Owner-facing rather than teaching-facing, so ADMIN only.
 *
 * <h3>Caveat that has to stay visible</h3>
 * {@code ai_token_usage} carries a price on a minority of rows — most of the
 * learner-chatbot rows have {@code total_price} null, and two models are entirely
 * unattributed. Credits are more complete than currency, so the headline figures
 * are credits and token volume, and the currency column says so when it is
 * missing rather than rendering a confident zero. Reporting "$0.00 spent" beside
 * 600 real calls would be worse than reporting nothing.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AiSpendSection implements ReportSection {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public String key() {
        return "ai_spend";
    }

    @Override
    public String title() {
        return "AI credit usage";
    }

    @Override
    public String description() {
        return "Credits used in the period, broken down by feature, with the "
                + "same period last time for comparison.";
    }

    @Override
    public Set<String> visibleToRoles() {
        return Set.of("ADMIN"); // spend is an owner concern, not a teaching one
    }

    @Override
    public Set<ReportContext.ScopeType> supportedScopes() {
        // Usage is recorded per institute, with no batch or subject dimension —
        // declaring BATCH here would fan out identical copies.
        return Set.of(ReportContext.ScopeType.INSTITUTE);
    }

    @Override
    public int creditWeight() {
        return 1;
    }

    @Override
    public boolean isAvailableFor(String instituteId) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ai_token_usage WHERE institute_id::text = ? "
                        + "AND created_at > now() - INTERVAL '30 days'",
                Integer.class, instituteId);
        return n != null && n > 0;
    }

    @Override
    public SectionFacts compute(ReportContext ctx) {
        Timestamp from = Timestamp.from(ctx.getWindowStart());
        Timestamp to = Timestamp.from(ctx.getWindowEnd());
        // Same-length window immediately before, for a like-for-like comparison.
        long span = ctx.getWindowEnd().toEpochMilli() - ctx.getWindowStart().toEpochMilli();
        Timestamp prevFrom = new Timestamp(ctx.getWindowStart().toEpochMilli() - span);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(BY_FEATURE_SQL,
                ctx.getInstituteId(), from, to);

        double credits = 0;
        long tokens = 0;
        int calls = 0;
        List<SectionFacts.Row> detail = new ArrayList<>();

        for (Map<String, Object> r : rows) {
            double c = dbl(r.get("credits"));
            long t = lng(r.get("tokens"));
            int n = (int) lng(r.get("calls"));
            credits += c;
            tokens += t;
            calls += n;
            Object priced = r.get("priced_calls");
            detail.add(SectionFacts.Row.builder()
                    .value(str(r.get("request_type"), "(unattributed)"))
                    .value(String.valueOf(n))
                    .value(fmt(c))
                    .value(String.format("%,d", t))
                    // Say when the cost figure is only partial rather than implying
                    // the whole feature was free.
                    .value(lng(priced) == n ? "priced" : lng(priced) + " of " + n + " priced")
                    .build());
        }

        Double prevCredits = jdbcTemplate.queryForObject(TOTAL_CREDITS_SQL, Double.class,
                ctx.getInstituteId(), prevFrom, from);
        String delta = describeDelta(credits, prevCredits == null ? 0 : prevCredits);

        return SectionFacts.builder()
                .sectionKey(key())
                .title(title())
                .identifying(false)
                .empty(calls == 0)
                .headline("Credits used", fmt(credits))
                .headline("vs previous period", delta)
                .headline("AI calls", String.valueOf(calls))
                .headline("Tokens", String.format("%,d", tokens))
                .column("Feature")
                .column("Calls")
                .column("Credits")
                .column("Tokens")
                .column("Cost data")
                .rows(detail)
                .build();
    }

    private static String describeDelta(double now, double before) {
        if (before <= 0) return now > 0 ? "first activity" : "—";
        long pct = Math.round(100.0 * (now - before) / before);
        if (pct == 0) return "unchanged";
        return (pct > 0 ? "+" : "") + pct + "%";
    }

    private static String fmt(double d) {
        return d >= 100 ? String.format("%,.0f", d) : String.format("%.1f", d);
    }

    private static double dbl(Object o) {
        return o == null ? 0d : ((Number) o).doubleValue();
    }

    private static long lng(Object o) {
        return o == null ? 0L : ((Number) o).longValue();
    }

    private static String str(Object o, String fallback) {
        String s = o == null ? null : String.valueOf(o).trim();
        return (s == null || s.isEmpty()) ? fallback : s;
    }

    private static final String BY_FEATURE_SQL = """
            SELECT COALESCE(request_type, '(unattributed)') AS request_type,
                   COUNT(*)                                  AS calls,
                   COALESCE(SUM(credits_used), 0)             AS credits,
                   COALESCE(SUM(total_tokens), 0)             AS tokens,
                   COUNT(*) FILTER (WHERE total_price IS NOT NULL) AS priced_calls
            FROM ai_token_usage
            WHERE institute_id::text = ?
              AND created_at >= ? AND created_at < ?
            GROUP BY 1
            ORDER BY credits DESC, calls DESC
            LIMIT 15
            """;

    private static final String TOTAL_CREDITS_SQL = """
            SELECT COALESCE(SUM(credits_used), 0)
            FROM ai_token_usage
            WHERE institute_id::text = ?
              AND created_at >= ? AND created_at < ?
            """;
}
