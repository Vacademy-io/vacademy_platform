package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.CallsDailyResponseDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.CallsHeatmapResponseDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.calling.FollowupAgingResponseDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Telephony + follow-up report aggregates for the Reports Center
 * (Calling and Follow-ups tabs): calls-daily, calls-heatmap, followup-aging.
 *
 * Raw JdbcTemplate SQL (SalesDashboardService pattern) — read-only, never
 * writes. Invariants honored here:
 *   - never JOIN users: names hydrated via the AuthService batch lookup;
 *   - call scoping is on telephony_call_log.counsellor_user_id directly;
 *   - follow-up scoping is on lead_followup.created_by (the counsellor who
 *     scheduled it — see {@code LeadFollowup});
 *   - timestamps are stored as UTC wall-clock in `timestamp` columns, so all
 *     day/hour bucketing is (col AT TIME ZONE 'UTC' AT TIME ZONE :tz) with the
 *     institute timezone from {@link LeadReportSettingService};
 *   - "connected" = institute-configurable status set (default ["COMPLETED"]);
 *   - RBAC scope CSV from {@link ReportScopeResolver}: null = no filter,
 *     "" matches nothing (zeroed report).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallingReportService {

    private final NamedParameterJdbcTemplate jdbc;
    private final ReportScopeResolver reportScopeResolver;
    private final LeadReportSettingService leadReportSettingService;
    private final AuthService authService;

    /** Mirrors LeadReportService — last 30 days when from/to omitted. */
    private static final int DEFAULT_RANGE_DAYS = 30;
    private static final int CLOSURE_REASON_WINDOW_DAYS = 30;
    private static final ZoneId FALLBACK_ZONE = ZoneId.of("Asia/Kolkata");

    // ─────────────────────────────────────────────────────────────────────
    // SQL
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Shared call-population predicate. The window column is
     * COALESCE(start_time, created_at): start_time is null until the provider
     * ACKs the call, so created_at keeps just-initiated/failed dials in the
     * dial counts. Range params are UTC instants (institute-TZ day bounds
     * converted in Java).
     */
    private static final String CALL_WHERE = """
            FROM telephony_call_log tcl
            WHERE tcl.institute_id = :instituteId
              AND COALESCE(tcl.start_time, tcl.created_at) >= :fromUtc
              AND COALESCE(tcl.start_time, tcl.created_at) < :toUtc
              AND (:scopeCsv IS NULL OR tcl.counsellor_user_id = ANY(STRING_TO_ARRAY(:scopeCsv, ',')))
            """;

    private static final String CALLS_DAILY_SQL = """
            SELECT (COALESCE(tcl.start_time, tcl.created_at) AT TIME ZONE 'UTC' AT TIME ZONE :tz)::date AS day,
                   COUNT(*) AS dials,
                   COUNT(*) FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))) AS connected,
                   COALESCE(SUM(COALESCE(tcl.duration_seconds, 0))
                            FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))), 0) AS talk_seconds
            """ + CALL_WHERE + """
            GROUP BY 1
            ORDER BY 1
            """;

    private static final String CALLS_BY_COUNSELLOR_SQL = """
            SELECT tcl.counsellor_user_id AS user_id,
                   COUNT(*) AS dials,
                   COUNT(*) FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))) AS connected,
                   COALESCE(SUM(COALESCE(tcl.duration_seconds, 0))
                            FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))), 0) AS talk_seconds
            """ + CALL_WHERE + """
            GROUP BY tcl.counsellor_user_id
            ORDER BY dials DESC
            """;

    private static final String CALL_OUTCOMES_SQL = """
            SELECT tcl.counsellor_user_id AS user_id,
                   tcl.status AS status,
                   COUNT(*) AS n
            """ + CALL_WHERE + """
            GROUP BY tcl.counsellor_user_id, tcl.status
            ORDER BY tcl.counsellor_user_id, n DESC
            """;

    private static final String CALLS_HEATMAP_SQL = """
            SELECT EXTRACT(ISODOW FROM (COALESCE(tcl.start_time, tcl.created_at) AT TIME ZONE 'UTC' AT TIME ZONE :tz))::int AS dow,
                   EXTRACT(HOUR FROM (COALESCE(tcl.start_time, tcl.created_at) AT TIME ZONE 'UTC' AT TIME ZONE :tz))::int AS hour,
                   COUNT(*) AS dials,
                   COUNT(*) FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))) AS connected
            """ + CALL_WHERE + """
            GROUP BY 1, 2
            ORDER BY 1, 2
            """;

    /**
     * Aging over OPEN follow-ups, point-in-time (no date window). d = calendar
     * days past due in the institute TZ: negative = upcoming, 0 = due today.
     * date - date is an integer in Postgres. Bands are disjoint: 1–3 / 4–7 / 8+.
     * Rows with a NULL schedule_time fall into no band by construction.
     * OPTED_OUT leads are excluded via the audience_response join.
     */
    private static final String FOLLOWUP_AGING_SQL = """
            SELECT t.user_id,
                   COUNT(*) FILTER (WHERE t.d < 0) AS upcoming,
                   COUNT(*) FILTER (WHERE t.d = 0) AS due_today,
                   COUNT(*) FILTER (WHERE t.d BETWEEN 1 AND 3) AS overdue_1_3,
                   COUNT(*) FILTER (WHERE t.d BETWEEN 4 AND 7) AS overdue_3_7,
                   COUNT(*) FILTER (WHERE t.d > 7) AS overdue_7_plus,
                   MAX(t.d) FILTER (WHERE t.d > 0) AS oldest_overdue_days
            FROM (
                SELECT lf.created_by AS user_id,
                       ((NOW() AT TIME ZONE :tz)::date
                        - (lf.schedule_time AT TIME ZONE 'UTC' AT TIME ZONE :tz)::date) AS d
                FROM lead_followup lf
                JOIN audience_response ar ON ar.id = lf.audience_response_id
                WHERE lf.institute_id = :instituteId
                  AND lf.is_closed = false
                  AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
                  AND (:scopeCsv IS NULL OR lf.created_by = ANY(STRING_TO_ARRAY(:scopeCsv, ',')))
                  AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
            ) t
            GROUP BY t.user_id
            """;

    /**
     * closed_at is stamped by the close endpoint; COALESCE to updated_at as a
     * belt-and-braces for legacy rows flipped without a close timestamp.
     */
    private static final String CLOSURE_REASONS_SQL = """
            SELECT COALESCE(NULLIF(TRIM(lf.closer_reason), ''), '(no reason)') AS reason,
                   COUNT(*) AS n
            FROM lead_followup lf
            JOIN audience_response ar ON ar.id = lf.audience_response_id
            WHERE lf.institute_id = :instituteId
              AND lf.is_closed = true
              AND COALESCE(lf.closed_at, lf.updated_at) >= :closedSince
              AND (ar.overall_status IS NULL OR ar.overall_status != 'OPTED_OUT')
              AND (:scopeCsv IS NULL OR lf.created_by = ANY(STRING_TO_ARRAY(:scopeCsv, ',')))
              AND (:audienceId IS NULL OR ar.audience_id = :audienceId)
            GROUP BY 1
            ORDER BY n DESC, reason ASC
            LIMIT 15
            """;

    // ─────────────────────────────────────────────────────────────────────
    // calls-daily
    // ─────────────────────────────────────────────────────────────────────

    public CallsDailyResponseDTO callsDaily(String instituteId, String fromDate, String toDate,
                                            String teamId, String counsellorUserId, String callerUserId) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(instituteId);
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId));
        MapSqlParameterSource params = callParams(instituteId, fromDate, toDate, tz, settings, scopeCsv);

        List<CallsDailyResponseDTO.DayRow> days = jdbc.query(CALLS_DAILY_SQL, params, (rs, i) -> {
            long dials = rs.getLong("dials");
            long connected = rs.getLong("connected");
            return CallsDailyResponseDTO.DayRow.builder()
                    .date(rs.getDate("day").toLocalDate().toString())
                    .dials(dials)
                    .connected(connected)
                    .connectRate(percentage(connected, dials))
                    .talkSeconds(rs.getLong("talk_seconds"))
                    .build();
        });

        // Per-counsellor outcome counts (status → n), merged into the rows below.
        Map<String, Map<String, Long>> outcomesByUser = new HashMap<>();
        jdbc.query(CALL_OUTCOMES_SQL, params, rs -> {
            outcomesByUser
                    .computeIfAbsent(rs.getString("user_id"), k -> new LinkedHashMap<>())
                    .put(rs.getString("status"), rs.getLong("n"));
        });

        List<CallsDailyResponseDTO.CounsellorRow> byCounsellor =
                jdbc.query(CALLS_BY_COUNSELLOR_SQL, params, (rs, i) -> {
                    String userId = rs.getString("user_id");
                    long dials = rs.getLong("dials");
                    long connected = rs.getLong("connected");
                    long talkSeconds = rs.getLong("talk_seconds");
                    return CallsDailyResponseDTO.CounsellorRow.builder()
                            .userId(userId)
                            .dials(dials)
                            .connected(connected)
                            .connectRate(percentage(connected, dials))
                            .talkSeconds(talkSeconds)
                            .avgCallSeconds(connected > 0
                                    ? Math.round(talkSeconds * 10.0 / connected) / 10.0 : null)
                            .outcomes(outcomesByUser.getOrDefault(userId, Map.of()))
                            .build();
                });

        Map<String, String> names = fetchNames(
                byCounsellor.stream().map(CallsDailyResponseDTO.CounsellorRow::getUserId).toList());
        byCounsellor.forEach(r -> r.setName(names.get(r.getUserId())));

        return CallsDailyResponseDTO.builder().days(days).byCounsellor(byCounsellor).build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // calls-heatmap
    // ─────────────────────────────────────────────────────────────────────

    public CallsHeatmapResponseDTO callsHeatmap(String instituteId, String fromDate, String toDate,
                                                String teamId, String counsellorUserId, String callerUserId) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(instituteId);
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId));
        MapSqlParameterSource params = callParams(instituteId, fromDate, toDate, tz, settings, scopeCsv);

        List<CallsHeatmapResponseDTO.Cell> cells = jdbc.query(CALLS_HEATMAP_SQL, params,
                (rs, i) -> CallsHeatmapResponseDTO.Cell.builder()
                        .dow(rs.getInt("dow"))
                        .hour(rs.getInt("hour"))
                        .dials(rs.getLong("dials"))
                        .connected(rs.getLong("connected"))
                        .build());

        return CallsHeatmapResponseDTO.builder().cells(cells).build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // followup-aging
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Point-in-time — fromDate/toDate are accepted by the controller for
     * signature consistency across report endpoints but intentionally ignored.
     */
    public FollowupAgingResponseDTO followupAging(String instituteId,
                                                  String teamId, String counsellorUserId,
                                                  String audienceId, String callerUserId) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(instituteId);
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                instituteId, callerUserId, trimToNull(teamId), trimToNull(counsellorUserId));

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("tz", tz.getId())
                .addValue("scopeCsv", scopeCsv, Types.VARCHAR)
                .addValue("audienceId", trimToNull(audienceId), Types.VARCHAR);

        long[] totals = new long[5]; // due_today, 1_3, 3_7, 7_plus, upcoming
        List<FollowupAgingResponseDTO.CounsellorRow> byCounsellor = new ArrayList<>();
        jdbc.query(FOLLOWUP_AGING_SQL, params, rs -> {
            long dueToday = rs.getLong("due_today");
            long o13 = rs.getLong("overdue_1_3");
            long o37 = rs.getLong("overdue_3_7");
            long o7p = rs.getLong("overdue_7_plus");
            long upcoming = rs.getLong("upcoming");
            totals[0] += dueToday;
            totals[1] += o13;
            totals[2] += o37;
            totals[3] += o7p;
            totals[4] += upcoming;
            String userId = rs.getString("user_id");
            if (userId == null) return; // bucket totals keep ownerless rows; the table skips them
            byCounsellor.add(FollowupAgingResponseDTO.CounsellorRow.builder()
                    .userId(userId)
                    .dueToday(dueToday)
                    .overdue1To3(o13)
                    .overdue3To7(o37)
                    .overdue7Plus(o7p)
                    .upcoming(upcoming)
                    .oldestOverdueDays(getNullableLong(rs, "oldest_overdue_days"))
                    .build());
        });
        // Most-buried counsellors first: total overdue desc, then due-today desc.
        byCounsellor.sort((a, b) -> {
            long oa = a.getOverdue1To3() + a.getOverdue3To7() + a.getOverdue7Plus();
            long ob = b.getOverdue1To3() + b.getOverdue3To7() + b.getOverdue7Plus();
            if (oa != ob) return Long.compare(ob, oa);
            return Long.compare(b.getDueToday(), a.getDueToday());
        });

        Map<String, String> names = fetchNames(
                byCounsellor.stream().map(FollowupAgingResponseDTO.CounsellorRow::getUserId).toList());
        byCounsellor.forEach(r -> r.setName(names.get(r.getUserId())));

        List<FollowupAgingResponseDTO.Bucket> buckets = List.of(
                new FollowupAgingResponseDTO.Bucket("DUE_TODAY", totals[0]),
                new FollowupAgingResponseDTO.Bucket("OVERDUE_1_3", totals[1]),
                new FollowupAgingResponseDTO.Bucket("OVERDUE_3_7", totals[2]),
                new FollowupAgingResponseDTO.Bucket("OVERDUE_7_PLUS", totals[3]),
                new FollowupAgingResponseDTO.Bucket("UPCOMING", totals[4]));

        MapSqlParameterSource closureParams = new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("scopeCsv", scopeCsv, Types.VARCHAR)
                .addValue("audienceId", trimToNull(audienceId), Types.VARCHAR)
                .addValue("closedSince",
                        LocalDateTime.now(ZoneOffset.UTC).minusDays(CLOSURE_REASON_WINDOW_DAYS),
                        Types.TIMESTAMP);
        List<FollowupAgingResponseDTO.ClosureReason> closureReasons =
                jdbc.query(CLOSURE_REASONS_SQL, closureParams,
                        (rs, i) -> new FollowupAgingResponseDTO.ClosureReason(
                                rs.getString("reason"), rs.getLong("n")));

        return FollowupAgingResponseDTO.builder()
                .buckets(buckets)
                .byCounsellor(byCounsellor)
                .closureReasons(closureReasons)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    /** Common bind set for the three call queries. */
    private MapSqlParameterSource callParams(String instituteId, String fromDate, String toDate,
                                             ZoneId tz, LeadReportSettingService.ReportSettings settings,
                                             String scopeCsv) {
        Window w = resolveWindow(fromDate, toDate, tz);
        return new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("tz", tz.getId())
                .addValue("connectedCsv", connectedCsv(settings))
                .addValue("scopeCsv", scopeCsv, Types.VARCHAR)
                .addValue("fromUtc", w.fromUtc(), Types.TIMESTAMP)
                .addValue("toUtc", w.toUtc(), Types.TIMESTAMP);
    }

    /**
     * fromDate/toDate are institute-TZ calendar dates (yyyy-MM-dd, both
     * inclusive). Convert to UTC instants for the half-open range predicate:
     * from 00:00 → (to + 1 day) 00:00 in the institute zone. Defaults to the
     * trailing 30 days ending today (institute TZ), matching LeadReportService.
     * Columns store UTC wall-clock, so we bind UTC LocalDateTimes — immune to
     * the JVM default zone (no java.sql.Timestamp involved).
     */
    private Window resolveWindow(String fromDate, String toDate, ZoneId tz) {
        LocalDate today = LocalDate.now(tz);
        LocalDate to = parseOr(toDate, today);
        LocalDate from = parseOr(fromDate, to.minusDays(DEFAULT_RANGE_DAYS - 1L));
        return new Window(
                from.atStartOfDay(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime(),
                to.plusDays(1).atStartOfDay(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
    }

    private record Window(LocalDateTime fromUtc, LocalDateTime toUtc) {
    }

    /** Bad/missing timezone config must degrade, not 500 the report. */
    private ZoneId safeZone(LeadReportSettingService.ReportSettings settings) {
        try {
            return ZoneId.of(settings.timezone());
        } catch (Exception e) {
            log.warn("[CallingReport] invalid report timezone '{}', falling back to {}",
                    settings != null ? settings.timezone() : null, FALLBACK_ZONE);
            return FALLBACK_ZONE;
        }
    }

    /** Connected-status set as the CSV the SQL FILTERs bind; defensive default COMPLETED. */
    private static String connectedCsv(LeadReportSettingService.ReportSettings settings) {
        Set<String> statuses = settings != null ? settings.connectedCallStatuses() : null;
        if (statuses == null || statuses.isEmpty()) return "COMPLETED";
        return String.join(",", statuses);
    }

    /**
     * Batch display-name hydration via auth-service (cross-DB — never JOIN
     * users in admin_core SQL). One HTTP call; failure leaves names null
     * instead of failing the report.
     */
    private Map<String, String> fetchNames(Collection<String> userIds) {
        List<String> ids = userIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        Map<String, String> out = new HashMap<>();
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(ids))) {
                if (u != null && u.getId() != null) out.put(u.getId(), u.getFullName());
            }
        } catch (Exception e) {
            log.warn("[CallingReport] counsellor name hydration failed: {}", e.getMessage());
        }
        return out;
    }

    private static LocalDate parseOr(String iso, LocalDate fallback) {
        if (iso == null || iso.isBlank()) return fallback;
        try {
            return LocalDate.parse(iso.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** num/denom as a 0–100 percentage, 1 decimal; null when denom == 0. */
    private static Double percentage(long num, long denom) {
        if (denom == 0) return null;
        return Math.round(num * 1000.0 / denom) / 10.0;
    }

    private static Long getNullableLong(ResultSet rs, String col) throws SQLException {
        long v = rs.getLong(col);
        return rs.wasNull() ? null : v;
    }
}
