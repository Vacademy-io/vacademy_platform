package vacademy.io.admin_core_service.features.sales_dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.LeaderboardEntryDTO;
import vacademy.io.admin_core_service.features.counsellor_rating.service.CounsellorRatingService;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.admin_core_service.features.sales_dashboard.dto.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.*;

/**
 * Read-only aggregates powering the sales dashboard widgets.
 *
 * Every endpoint accepts optional teamId. When supplied, the query is scoped
 * to leads assigned to anyone in that team's subtree (resolved via
 * CounsellorScopeService). When omitted, the institute-wide totals are
 * returned — and the controller layer is responsible for gating that on the
 * SALES_DASHBOARD_VIEW_ALL_TEAMS permission.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalesDashboardService {

    private final JdbcTemplate jdbc;
    private final CounsellorScopeService scopeService;
    private final CounsellorRatingService ratingService;

    // ────────────────────────────────────────────────────────────────
    // KPI band
    // ────────────────────────────────────────────────────────────────

    public KpiDTO kpi(String instituteId, String teamId, Timestamp from, Timestamp to) {
        List<String> users = scopedUsers(instituteId, teamId);
        String userClause = userScopeClause(users);
        Object[] argsBase = new Object[]{instituteId};

        Long totalLeads = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_lead_profile WHERE institute_id = ? " +
                        andDateRange("created_at", from, to) + userClause,
                Long.class, argsWithRange(argsBase, from, to, users));
        Long openLeads = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_lead_profile WHERE institute_id = ? AND conversion_status = 'LEAD'" +
                        userClause,
                Long.class, argsConcat(argsBase, users));
        Long conversions = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_lead_profile WHERE institute_id = ? AND conversion_status = 'CONVERTED'" +
                        andDateRange("converted_at", from, to) + userClause,
                Long.class, argsWithRange(argsBase, from, to, users));

        BigDecimal rate = (totalLeads != null && totalLeads > 0)
                ? BigDecimal.valueOf(conversions != null ? conversions : 0)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(totalLeads), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Long activeCounsellors = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT cpm.counselor_user_id) FROM counselor_pool_member cpm " +
                        " JOIN counselor_pool cp ON cp.id = cpm.pool_id " +
                        "WHERE cp.institute_id = ? AND cpm.status = 'ACTIVE'",
                Long.class, instituteId);

        Long overdueFollowups = jdbc.queryForObject(
                "SELECT COUNT(*) FROM lead_followup lf " +
                        "WHERE lf.institute_id = ? " +
                        "  AND lf.is_closed = false " +
                        "  AND (lf.status = 'OVERDUE' OR " +
                        "       (lf.status = 'PENDING' AND lf.schedule_time < NOW()))",
                Long.class, instituteId);

        return KpiDTO.builder()
                .totalLeads(nz(totalLeads))
                .openLeads(nz(openLeads))
                .conversions(nz(conversions))
                .conversionRate(rate)
                .activeCounsellors(nz(activeCounsellors))
                .overdueFollowups(nz(overdueFollowups))
                .build();
    }

    // ────────────────────────────────────────────────────────────────
    // Conversion funnel
    // ────────────────────────────────────────────────────────────────

    public List<FunnelStageDTO> conversionFunnel(String instituteId, String teamId,
                                                 Timestamp from, Timestamp to) {
        List<String> users = scopedUsers(instituteId, teamId);
        String userClause = userScopeClause(users, "ulp.assigned_counselor_id");
        // Pipeline stages from lead_status; counts come from the latest status
        // each lead is currently in (via user_lead_profile.conversion_status
        // when no custom status, otherwise via the latest audience_response).
        // The date-range and user-scope predicates are inside the WHERE so the
        // parameter order matches the args list: [instituteId, from?, to?,
        // users…, instituteId-for-lead_status].
        String dateClause = andDateRange("ulp.created_at", from, to);
        String sql = "SELECT ls.status_key, ls.label, ls.color, ls.sort_order, " +
                "       COUNT(DISTINCT ulp.id) AS lead_count " +
                "FROM lead_status ls " +
                "LEFT JOIN audience_response ar ON ar.lead_status_id = ls.id " +
                "LEFT JOIN user_lead_profile ulp ON ulp.user_id = ar.user_id " +
                "    AND ulp.institute_id = ?" +
                dateClause +
                userClause +
                "WHERE ls.institute_id = ? AND ls.status = 'ACTIVE' " +
                "GROUP BY ls.status_key, ls.label, ls.color, ls.sort_order " +
                "ORDER BY ls.sort_order";

        List<Object> args = new ArrayList<>();
        args.add(instituteId);                                 // ulp.institute_id in JOIN
        if (from != null) args.add(from);
        if (to != null) args.add(to);
        args.addAll(users);
        args.add(instituteId);                                 // ls.institute_id in WHERE

        return jdbc.query(sql,
                (rs, rowNum) -> FunnelStageDTO.builder()
                        .statusKey(rs.getString("status_key"))
                        .label(rs.getString("label"))
                        .color(rs.getString("color"))
                        .count(rs.getLong("lead_count"))
                        .order(rs.getInt("sort_order"))
                        .build(),
                args.toArray());
    }

    // ────────────────────────────────────────────────────────────────
    // Reassignment volume (daily series)
    // ────────────────────────────────────────────────────────────────

    public List<TimeSeriesPointDTO> reassignmentSeries(String instituteId, Timestamp from, Timestamp to) {
        // Counts only OUT events to avoid double-counting (the pair (OUT, IN)
        // we write per transfer would otherwise show 2x).
        return jdbc.query(
                "SELECT DATE(te.created_at) AS day, COUNT(*) AS n " +
                "FROM timeline_event te " +
                "WHERE te.action_type = 'Counselor reassigned' " +
                "  AND te.created_at >= ? AND te.created_at < ? " +
                "  AND te.metadata_json::jsonb ? 'reassigned_from' " +
                "  AND te.metadata_json::jsonb ? 'trigger' " +
                "GROUP BY DATE(te.created_at) " +
                "ORDER BY day",
                (rs, rowNum) -> TimeSeriesPointDTO.builder()
                        .date(rs.getDate("day").toLocalDate())
                        .primary(rs.getLong("n"))
                        .build(),
                from, to);
    }

    // ────────────────────────────────────────────────────────────────
    // Followups (upcoming + missed)
    // ────────────────────────────────────────────────────────────────

    public List<FollowupRowDTO> upcomingFollowups(String instituteId, String teamId, int hoursAhead, int limit) {
        List<String> users = scopedUsers(instituteId, teamId);
        String userClause = userScopeClause(users, "lf.created_by");
        return jdbc.query(
                "SELECT lf.id AS followup_id, " +
                "       ulp.id AS lead_id, " +
                "       u.full_name AS lead_name, " +
                "       lf.created_by AS counsellor_id, " +
                "       (SELECT full_name FROM users WHERE id = lf.created_by) AS counsellor_name, " +
                "       lf.schedule_time, lf.status, lf.content, " +
                "       EXTRACT(EPOCH FROM (lf.schedule_time - NOW())) / 60 AS minutes_until_due " +
                "FROM lead_followup lf " +
                "JOIN audience_response ar ON ar.id = lf.audience_response_id " +
                "LEFT JOIN user_lead_profile ulp ON ulp.user_id = ar.user_id AND ulp.institute_id = lf.institute_id " +
                "LEFT JOIN users u ON u.id = ar.user_id " +
                "WHERE lf.institute_id = ? " +
                "  AND lf.is_closed = false " +
                "  AND lf.status = 'PENDING' " +
                "  AND lf.schedule_time BETWEEN NOW() AND NOW() + (? || ' hours')::interval " +
                userClause +
                "ORDER BY lf.schedule_time ASC " +
                "LIMIT ?",
                (rs, rowNum) -> followupFromRow(rs),
                argsForFollowups(instituteId, hoursAhead, users, limit));
    }

    public List<FollowupRowDTO> missedFollowups(String instituteId, String teamId, int limit) {
        List<String> users = scopedUsers(instituteId, teamId);
        String userClause = userScopeClause(users, "lf.created_by");
        return jdbc.query(
                "SELECT lf.id AS followup_id, " +
                "       ulp.id AS lead_id, " +
                "       u.full_name AS lead_name, " +
                "       lf.created_by AS counsellor_id, " +
                "       (SELECT full_name FROM users WHERE id = lf.created_by) AS counsellor_name, " +
                "       lf.schedule_time, lf.status, lf.content, " +
                "       EXTRACT(EPOCH FROM (lf.schedule_time - NOW())) / 60 AS minutes_until_due " +
                "FROM lead_followup lf " +
                "JOIN audience_response ar ON ar.id = lf.audience_response_id " +
                "LEFT JOIN user_lead_profile ulp ON ulp.user_id = ar.user_id AND ulp.institute_id = lf.institute_id " +
                "LEFT JOIN users u ON u.id = ar.user_id " +
                "WHERE lf.institute_id = ? " +
                "  AND lf.is_closed = false " +
                "  AND (lf.status = 'OVERDUE' OR (lf.status = 'PENDING' AND lf.schedule_time < NOW())) " +
                userClause +
                "ORDER BY lf.schedule_time ASC " +
                "LIMIT ?",
                (rs, rowNum) -> followupFromRow(rs),
                argsForMissed(instituteId, users, limit));
    }

    // ────────────────────────────────────────────────────────────────
    // New vs existing leads (daily)
    // ────────────────────────────────────────────────────────────────

    public List<TimeSeriesPointDTO> newVsExisting(String instituteId, String teamId,
                                                  Timestamp from, Timestamp to) {
        List<String> users = scopedUsers(instituteId, teamId);
        // "new" = lead created within [from, to). "existing" = lead created
        // before from but had any activity (timeline_event) within [from, to).
        String userClause = userScopeClause(users, "ulp.assigned_counselor_id");
        // First series: new leads per day.
        Map<LocalDate, long[]> byDay = new TreeMap<>();
        jdbc.query("SELECT DATE(ulp.created_at) AS day, COUNT(*) AS n " +
                        "FROM user_lead_profile ulp " +
                        "WHERE ulp.institute_id = ? " +
                        "  AND ulp.created_at >= ? AND ulp.created_at < ? " +
                        userClause +
                        "GROUP BY DATE(ulp.created_at) ORDER BY day",
                rs -> {
                    LocalDate d = rs.getDate("day").toLocalDate();
                    long[] arr = byDay.computeIfAbsent(d, k -> new long[]{0, 0});
                    arr[0] = rs.getLong("n");
                },
                argsConcatTail(argsConcat(new Object[]{instituteId}, users), from, to));

        // Second series: existing leads with activity per day (count of
        // distinct user_lead_profile.id that had timeline_event in the window
        // and were created before the window).
        jdbc.query("SELECT DATE(te.created_at) AS day, COUNT(DISTINCT te.type_id) AS n " +
                        "FROM timeline_event te " +
                        "JOIN user_lead_profile ulp ON ulp.id = te.type_id " +
                        "WHERE ulp.institute_id = ? " +
                        "  AND te.created_at >= ? AND te.created_at < ? " +
                        "  AND ulp.created_at < ? " +
                        userClause +
                        "GROUP BY DATE(te.created_at) ORDER BY day",
                rs -> {
                    LocalDate d = rs.getDate("day").toLocalDate();
                    long[] arr = byDay.computeIfAbsent(d, k -> new long[]{0, 0});
                    arr[1] = rs.getLong("n");
                },
                argsConcatTail(argsConcat(new Object[]{instituteId}, users), from, to, from));

        List<TimeSeriesPointDTO> out = new ArrayList<>(byDay.size());
        for (Map.Entry<LocalDate, long[]> e : byDay.entrySet()) {
            out.add(TimeSeriesPointDTO.builder()
                    .date(e.getKey()).primary(e.getValue()[0]).secondary(e.getValue()[1]).build());
        }
        return out;
    }

    // ────────────────────────────────────────────────────────────────
    // Campaign cards
    // ────────────────────────────────────────────────────────────────

    public List<CampaignCardDTO> campaignCards(String instituteId, String period) {
        long since = switch (period == null ? "WEEK" : period.toUpperCase(Locale.ROOT)) {
            case "DAY" -> System.currentTimeMillis() - 24L * 3600 * 1000;
            case "MONTH" -> System.currentTimeMillis() - 30L * 24 * 3600 * 1000;
            case "WEEK" -> System.currentTimeMillis() - 7L * 24 * 3600 * 1000;
            default -> System.currentTimeMillis() - 7L * 24 * 3600 * 1000;
        };
        Timestamp sinceTs = new Timestamp(since);

        return jdbc.query(
                "SELECT a.id AS campaign_id, a.campaign_name, a.campaign_type, " +
                "       COUNT(DISTINCT ar.id) AS leads_in_window, " +
                "       COUNT(DISTINCT CASE WHEN ulp.conversion_status = 'CONVERTED' THEN ulp.id END) AS conversions, " +
                "       (SELECT ulp2.assigned_counselor_id FROM user_lead_profile ulp2 " +
                "          JOIN audience_response ar2 ON ar2.user_id = ulp2.user_id " +
                "         WHERE ar2.audience_id = a.id AND ar2.created_at >= ? AND ulp2.conversion_status = 'CONVERTED' " +
                "         GROUP BY ulp2.assigned_counselor_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_counsellor_user_id, " +
                "       (SELECT COUNT(*) FROM user_lead_profile ulp3 " +
                "          JOIN audience_response ar3 ON ar3.user_id = ulp3.user_id " +
                "         WHERE ar3.audience_id = a.id AND ar3.created_at >= ? AND ulp3.conversion_status = 'CONVERTED' " +
                "         GROUP BY ulp3.assigned_counselor_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_counsellor_conversions " +
                "FROM audience a " +
                "LEFT JOIN audience_response ar ON ar.audience_id = a.id AND ar.created_at >= ? " +
                "LEFT JOIN user_lead_profile ulp ON ulp.user_id = ar.user_id AND ulp.institute_id = a.institute_id " +
                "WHERE a.institute_id = ? " +
                "GROUP BY a.id, a.campaign_name, a.campaign_type " +
                "ORDER BY leads_in_window DESC " +
                "LIMIT 20",
                (rs, rowNum) -> {
                    Long leadsN = rs.getLong("leads_in_window");
                    Long convN = rs.getLong("conversions");
                    BigDecimal rate = leadsN > 0
                            ? BigDecimal.valueOf(convN).multiply(BigDecimal.valueOf(100))
                                .divide(BigDecimal.valueOf(leadsN), 2, RoundingMode.HALF_UP)
                            : BigDecimal.ZERO;
                    return CampaignCardDTO.builder()
                            .campaignId(rs.getString("campaign_id"))
                            .campaignName(rs.getString("campaign_name"))
                            .campaignType(rs.getString("campaign_type"))
                            .leadsInWindow(leadsN)
                            .conversionsInWindow(convN)
                            .conversionRate(rate)
                            .topCounsellorUserId(rs.getString("top_counsellor_user_id"))
                            .topCounsellorConversions(getNullableLong(rs, "top_counsellor_conversions"))
                            .build();
                },
                sinceTs, sinceTs, sinceTs, instituteId);
    }

    // ────────────────────────────────────────────────────────────────
    // Counsellor leaderboard (delegates)
    // ────────────────────────────────────────────────────────────────

    public List<LeaderboardEntryDTO> counsellorLeaderboard(String instituteId, String teamId, int limit) {
        return ratingService.leaderboard(instituteId, teamId, limit);
    }

    // ────────────────────────────────────────────────────────────────
    // Insights (deterministic, NOT LLM)
    // ────────────────────────────────────────────────────────────────

    public List<InsightDTO> insights(String instituteId, String teamId) {
        List<InsightDTO> out = new ArrayList<>();
        // WoW conversion rate change.
        try {
            Double thisWeek = jdbc.queryForObject(
                    "SELECT 100.0 * AVG(CASE WHEN conversion_status='CONVERTED' THEN 1 ELSE 0 END) " +
                            "FROM user_lead_profile WHERE institute_id = ? " +
                            "  AND created_at >= NOW() - INTERVAL '7 days'",
                    Double.class, instituteId);
            Double lastWeek = jdbc.queryForObject(
                    "SELECT 100.0 * AVG(CASE WHEN conversion_status='CONVERTED' THEN 1 ELSE 0 END) " +
                            "FROM user_lead_profile WHERE institute_id = ? " +
                            "  AND created_at >= NOW() - INTERVAL '14 days' " +
                            "  AND created_at <  NOW() - INTERVAL '7 days'",
                    Double.class, instituteId);
            if (thisWeek != null && lastWeek != null && lastWeek > 0) {
                double delta = ((thisWeek - lastWeek) / lastWeek) * 100.0;
                String sev = delta >= 0 ? "SUCCESS" : "WARN";
                out.add(InsightDTO.builder().key("CONVERSION_WOW").severity(sev)
                        .headline(String.format(Locale.US, "Conversion rate %.1f%% (%s%.1f%% WoW)",
                                thisWeek, delta >= 0 ? "+" : "", delta))
                        .detail("Rolling 7-day vs prior 7-day window.").build());
            }
        } catch (Exception e) {
            log.debug("WoW insight failed: {}", e.getMessage());
        }
        // Overdue followups spike.
        try {
            Long overdue = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM lead_followup WHERE institute_id = ? " +
                            "AND is_closed=false " +
                            "AND (status='OVERDUE' OR (status='PENDING' AND schedule_time < NOW()))",
                    Long.class, instituteId);
            if (overdue != null && overdue > 0) {
                out.add(InsightDTO.builder().key("OVERDUE_SPIKE")
                        .severity(overdue > 10 ? "DANGER" : "WARN")
                        .headline(overdue + " missed followups")
                        .detail("Open the Missed Followups widget to act.").build());
            }
        } catch (Exception e) {
            log.debug("Overdue insight failed: {}", e.getMessage());
        }
        return out;
    }

    // ────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────

    /**
     * Resolve the user-id whitelist the dashboard should count against.
     *
     * Priority:
     *   1. Explicit {@code teamId} → that team's members only (caller-driven
     *      narrowing for managers who pick a specific team).
     *   2. Default → users in every team under the institute's configured
     *      leads_team_id. This is the "sales dashboard only shows sales
     *      counsellors" guarantee — without it the funnel/KPIs would silently
     *      count every active user in the institute.
     *   3. Leads team not configured → empty list, which {@link #userScopeClause}
     *      translates to "no scope filter" (institute-wide fallback so the
     *      page still renders something while the admin is mid-setup).
     */
    private List<String> scopedUsers(String instituteId, String teamId) {
        if (teamId != null && !teamId.isBlank()) {
            return scopeService.usersInTeams(java.util.List.of(teamId));
        }
        List<String> teamIds = scopeService.allTeamIdsUnderLeadsRoot(instituteId);
        if (teamIds.isEmpty()) return Collections.emptyList();
        return scopeService.usersInTeams(teamIds);
    }

    private String userScopeClause(List<String> users) {
        return userScopeClause(users, "assigned_counselor_id");
    }

    private String userScopeClause(List<String> users, String column) {
        if (users == null || users.isEmpty()) return " ";
        String placeholders = String.join(",", Collections.nCopies(users.size(), "?"));
        return " AND " + column + " IN (" + placeholders + ") ";
    }

    private String andDateRange(String column, Timestamp from, Timestamp to) {
        StringBuilder sb = new StringBuilder();
        if (from != null) sb.append(" AND ").append(column).append(" >= ?");
        if (to != null) sb.append(" AND ").append(column).append(" < ?");
        return sb.toString();
    }

    private Object[] argsWithRange(Object[] base, Timestamp from, Timestamp to, List<String> users) {
        return argsConcatTail(argsConcat(base, addRange(from, to)), users.toArray());
    }

    private Object[] argsConcat(Object[] base, Collection<String> tail) {
        Object[] out = Arrays.copyOf(base, base.length + tail.size());
        int i = base.length;
        for (String s : tail) out[i++] = s;
        return out;
    }

    private Object[] argsConcat(Object[] base, Object[] tail) {
        Object[] out = Arrays.copyOf(base, base.length + tail.length);
        System.arraycopy(tail, 0, out, base.length, tail.length);
        return out;
    }

    private Object[] argsConcatTail(Object[] base, Object... tail) {
        return argsConcat(base, tail);
    }

    private List<Object> addRange(Timestamp from, Timestamp to) {
        List<Object> out = new ArrayList<>(2);
        if (from != null) out.add(from);
        if (to != null) out.add(to);
        return out;
    }

    @SuppressWarnings("unchecked")
    private Object[] argsConcat(Object[] base, List<Object> mid) {
        Object[] out = Arrays.copyOf(base, base.length + mid.size());
        for (int i = 0; i < mid.size(); i++) out[base.length + i] = mid.get(i);
        return out;
    }

    private Object[] argsForFollowups(String instituteId, int hoursAhead, List<String> users, int limit) {
        List<Object> args = new ArrayList<>();
        args.add(instituteId);
        args.add(hoursAhead);
        args.addAll(users);
        args.add(limit);
        return args.toArray();
    }

    private Object[] argsForMissed(String instituteId, List<String> users, int limit) {
        List<Object> args = new ArrayList<>();
        args.add(instituteId);
        args.addAll(users);
        args.add(limit);
        return args.toArray();
    }

    private FollowupRowDTO followupFromRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        return FollowupRowDTO.builder()
                .followupId(rs.getString("followup_id"))
                .leadId(rs.getString("lead_id"))
                .leadName(rs.getString("lead_name"))
                .counsellorUserId(rs.getString("counsellor_id"))
                .counsellorName(rs.getString("counsellor_name"))
                .scheduleTime(rs.getTimestamp("schedule_time"))
                .status(rs.getString("status"))
                .content(rs.getString("content"))
                .minutesUntilDue(getNullableLong(rs, "minutes_until_due"))
                .build();
    }

    private static Long getNullableLong(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }

    private static long nz(Long v) {
        return v != null ? v : 0L;
    }
}
