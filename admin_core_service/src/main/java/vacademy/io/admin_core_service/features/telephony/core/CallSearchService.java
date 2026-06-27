package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.LeadReportSettingService;
import vacademy.io.admin_core_service.features.audience.service.ReportScopeResolver;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallMetricsDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallRowDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallSearchFilterDTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Paginated, RBAC-scoped call search for the team calling dashboard. Reads the
 * single universal call table (telephony_call_log) so AI (Aavtaar) and human
 * (Exotel/Airtel), inbound and outbound, every provider, show up together;
 * {@code callType} is derived (AI = an Aavtaar call or one with an
 * ai_call_result), never a stored column.
 *
 * <p>Same conventions as {@link vacademy.io.admin_core_service.features.audience.service.CallingReportService}:
 * raw NamedParameterJdbcTemplate (read-only), institute-TZ day bounds converted
 * to UTC instants, "connected" is the institute-configurable status set, scope
 * comes from {@link ReportScopeResolver} (null = institute-wide admin, "" =
 * zeroed), and counsellor names are hydrated via the auth-service batch lookup
 * (never JOIN users).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallSearchService {

    private final NamedParameterJdbcTemplate jdbc;
    private final ReportScopeResolver reportScopeResolver;
    private final LeadReportSettingService leadReportSettingService;
    private final AuthService authService;

    private static final int DEFAULT_RANGE_DAYS = 30;
    private static final int MAX_PAGE_SIZE = 200;
    private static final ZoneId FALLBACK_ZONE = ZoneId.of("Asia/Kolkata");

    /** Per-row AI metadata (latest result wins on webhook dupes), joined laterally. */
    private static final String AI_LATERAL = """
            LEFT JOIN LATERAL (
                SELECT r.id AS acr_id, r.disposition AS ai_disposition, r.callback_at AS ai_callback_at
                FROM ai_call_result r
                WHERE r.call_log_id = tcl.id
                ORDER BY r.received_at DESC NULLS LAST
                LIMIT 1
            ) acr ON TRUE
            """;

    /**
     * "No later connected call to this lead" — shared by the missed-inbound and
     * callbacks-due chips so an entry self-clears the moment anyone reconnects.
     * A later call counts as connected if it was answered, had talk time, or its
     * status is in the institute's connected set.
     */
    private static final String NO_LATER_CONNECT = """
            AND tcl.user_id IS NOT NULL AND tcl.user_id <> 'UNKNOWN'
            AND NOT EXISTS (
                SELECT 1 FROM telephony_call_log t2
                WHERE t2.institute_id = tcl.institute_id
                  AND t2.user_id = tcl.user_id
                  AND COALESCE(t2.start_time, t2.created_at) > COALESCE(tcl.start_time, tcl.created_at)
                  AND (t2.answer_time IS NOT NULL
                       OR COALESCE(t2.duration_seconds, 0) > 0
                       OR t2.status = ANY(STRING_TO_ARRAY(:connectedCsv, ',')))
            )
            """;

    public Page<CallRowDTO> search(CallSearchFilterDTO f, String callerUserId, boolean unmaskNumbers) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(f.getInstituteId());
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                f.getInstituteId(), callerUserId, trimToNull(f.getTeamId()), trimToNull(f.getCounsellorUserId()));

        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = buildWhere(f, tz, settings, scopeCsv, params, true);

        Long total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM telephony_call_log tcl " + AI_LATERAL +
                        " LEFT JOIN audience_response ar ON ar.id = tcl.response_id " + where,
                params, Long.class);
        long count = total == null ? 0 : total;

        int size = Math.min(f.getSize() <= 0 ? 25 : f.getSize(), MAX_PAGE_SIZE);
        int page = Math.max(f.getPage(), 0);
        PageRequest pageable = PageRequest.of(page, size);
        if (count == 0) {
            return new PageImpl<>(List.of(), pageable, 0);
        }

        params.addValue("limit", size).addValue("offset", (long) page * size);
        String sql = ROW_SELECT + " FROM telephony_call_log tcl " + AI_LATERAL +
                " LEFT JOIN audience_response ar ON ar.id = tcl.response_id " +
                where + orderBy(f) + " LIMIT :limit OFFSET :offset";

        List<CallRowDTO> rows = jdbc.query(sql, params, (rs, i) -> mapRow(rs, unmaskNumbers));

        Map<String, String> names = fetchNames(
                rows.stream().map(CallRowDTO::getCounsellorUserId).toList());
        rows.forEach(r -> r.setCounsellorName(names.get(r.getCounsellorUserId())));

        return new PageImpl<>(rows, pageable, count);
    }

    // ── Export ────────────────────────────────────────────────────────────────

    /**
     * Flat, capped projection of the filtered call list for CSV/XLSX export — same
     * filters + scope + masking as {@link #search}, no pagination. Honors the chips.
     */
    public List<CallRowDTO> exportRows(CallSearchFilterDTO f, String callerUserId, boolean unmaskNumbers, int cap) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(f.getInstituteId());
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                f.getInstituteId(), callerUserId, trimToNull(f.getTeamId()), trimToNull(f.getCounsellorUserId()));

        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = buildWhere(f, tz, settings, scopeCsv, params, true);
        params.addValue("cap", cap);

        String sql = ROW_SELECT + " FROM telephony_call_log tcl " + AI_LATERAL +
                " LEFT JOIN audience_response ar ON ar.id = tcl.response_id " +
                where + orderBy(f) + " LIMIT :cap";

        List<CallRowDTO> rows = jdbc.query(sql, params, (rs, i) -> mapRow(rs, unmaskNumbers));
        Map<String, String> names = fetchNames(rows.stream().map(CallRowDTO::getCounsellorUserId).toList());
        rows.forEach(r -> r.setCounsellorName(names.get(r.getCounsellorUserId())));
        return rows;
    }

    // ── KPI strip ───────────────────────────────────────────────────────────────

    private static final String METRICS_HEAD = """
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))) AS connected,
                   COALESCE(SUM(COALESCE(tcl.duration_seconds, 0))
                            FILTER (WHERE tcl.status = ANY(STRING_TO_ARRAY(:connectedCsv, ','))), 0) AS talk_seconds,
                   COUNT(DISTINCT tcl.user_id) FILTER (WHERE tcl.user_id IS NOT NULL AND tcl.user_id <> 'UNKNOWN') AS unique_leads,
                   COUNT(*) FILTER (WHERE tcl.direction = 'INBOUND') AS inbound,
                   COUNT(*) FILTER (WHERE tcl.direction = 'OUTBOUND') AS outbound,
                   COUNT(*) FILTER (WHERE acr.acr_id IS NOT NULL OR tcl.provider_type = 'AAVTAAR') AS ai_calls
            """;

    /**
     * KPI strip. Headline counts honor every filter EXCEPT the chips (so the
     * strip matches the table); the two chip badges are scope+date-window totals
     * (independent of the table's other filters — they're "needs attention" counts).
     */
    public CallMetricsDTO metrics(CallSearchFilterDTO f, String callerUserId) {
        LeadReportSettingService.ReportSettings settings = leadReportSettingService.get(f.getInstituteId());
        ZoneId tz = safeZone(settings);
        String scopeCsv = reportScopeResolver.resolveScopeUsersCsv(
                f.getInstituteId(), callerUserId, trimToNull(f.getTeamId()), trimToNull(f.getCounsellorUserId()));

        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = buildWhere(f, tz, settings, scopeCsv, params, false);

        CallMetricsDTO m = jdbc.queryForObject(
                METRICS_HEAD + " FROM telephony_call_log tcl " + AI_LATERAL +
                        " LEFT JOIN audience_response ar ON ar.id = tcl.response_id " + where,
                params, (rs, i) -> {
                    long total = rs.getLong("total");
                    long connected = rs.getLong("connected");
                    long talk = rs.getLong("talk_seconds");
                    long ai = rs.getLong("ai_calls");
                    return CallMetricsDTO.builder()
                            .totalCalls(total)
                            .connectedCalls(connected)
                            .connectRate(total == 0 ? null : Math.round(connected * 1000.0 / total) / 10.0)
                            .totalTalkSeconds(talk)
                            .avgTalkSeconds(connected == 0 ? null : Math.round(talk * 10.0 / connected) / 10.0)
                            .uniqueLeads(rs.getLong("unique_leads"))
                            .inboundCalls(rs.getLong("inbound"))
                            .outboundCalls(rs.getLong("outbound"))
                            .aiCalls(ai)
                            .humanCalls(total - ai)
                            .build();
                });
        if (m == null) m = CallMetricsDTO.builder().build();

        m.setMissedInboundDue(chipCount(f, tz, settings, scopeCsv, true, false));
        m.setCallbacksDue(chipCount(f, tz, settings, scopeCsv, false, true));
        return m;
    }

    /** COUNT(*) for one worklist chip over scope + date window only (ignores the table's other filters). */
    private long chipCount(CallSearchFilterDTO src, ZoneId tz, LeadReportSettingService.ReportSettings settings,
                           String scopeCsv, boolean missed, boolean callbacks) {
        CallSearchFilterDTO chip = new CallSearchFilterDTO();
        chip.setInstituteId(src.getInstituteId());
        chip.setFromDate(src.getFromDate());
        chip.setToDate(src.getToDate());
        chip.setMissedInbound(missed);
        chip.setCallbacksDue(callbacks);
        MapSqlParameterSource p = new MapSqlParameterSource();
        String where = buildWhere(chip, tz, settings, scopeCsv, p, true);
        Long c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM telephony_call_log tcl " + AI_LATERAL +
                        " LEFT JOIN audience_response ar ON ar.id = tcl.response_id " + where,
                p, Long.class);
        return c == null ? 0 : c;
    }

    private static final String ROW_SELECT = """
            SELECT tcl.id, tcl.provider_type, tcl.direction, tcl.status, tcl.termination_reason,
                   tcl.from_number, tcl.to_number, tcl.caller_id,
                   CASE WHEN tcl.direction = 'OUTBOUND' THEN tcl.to_number ELSE tcl.from_number END AS lead_number,
                   tcl.start_time, tcl.answer_time, tcl.end_time, tcl.duration_seconds,
                   tcl.recording_storage_key, tcl.counsellor_user_id, tcl.response_id, tcl.user_id,
                   tcl.disposition_key, tcl.disposition_notes, tcl.dispositioned_at, tcl.created_at,
                   ar.parent_name AS lead_name,
                   acr.ai_disposition AS ai_disposition,
                   CASE WHEN (acr.acr_id IS NOT NULL OR tcl.provider_type = 'AAVTAAR') THEN 'AI' ELSE 'HUMAN' END AS call_type,
                   COALESCE(tcl.callback_at, acr.ai_callback_at AT TIME ZONE 'UTC') AS callback_at_eff
            """;

    /** Shared row projection mapper for the search page and the live panel. */
    private CallRowDTO mapRow(java.sql.ResultSet rs, boolean unmaskNumbers) throws java.sql.SQLException {
        return CallRowDTO.builder()
                .id(rs.getString("id"))
                .providerType(rs.getString("provider_type"))
                .callType(rs.getString("call_type"))
                .direction(rs.getString("direction"))
                .status(rs.getString("status"))
                .terminationReason(rs.getString("termination_reason"))
                .fromNumber(mask(rs.getString("from_number"), unmaskNumbers))
                .toNumber(mask(rs.getString("to_number"), unmaskNumbers))
                .leadNumber(mask(rs.getString("lead_number"), unmaskNumbers))
                .callerId(rs.getString("caller_id"))
                .startTime(rs.getTimestamp("start_time"))
                .answerTime(rs.getTimestamp("answer_time"))
                .endTime(rs.getTimestamp("end_time"))
                .durationSeconds(getNullableInt(rs, "duration_seconds"))
                .hasRecording(rs.getString("recording_storage_key") != null)
                .counsellorUserId(rs.getString("counsellor_user_id"))
                .responseId(rs.getString("response_id"))
                .userId(rs.getString("user_id"))
                .leadName(rs.getString("lead_name"))
                .dispositionKey(rs.getString("disposition_key"))
                .dispositionNotes(rs.getString("disposition_notes"))
                .dispositionedAt(rs.getTimestamp("dispositioned_at"))
                .aiDisposition(rs.getString("ai_disposition"))
                .callbackAt(rs.getTimestamp("callback_at_eff"))
                .createdAt(rs.getTimestamp("created_at"))
                .build();
    }

    /** Builds the shared FROM-tail WHERE (binds into {@code params}) for both count and page. */
    private String buildWhere(CallSearchFilterDTO f, ZoneId tz,
                              LeadReportSettingService.ReportSettings settings,
                              String scopeCsv, MapSqlParameterSource params, boolean includeChips) {
        Window w = resolveWindow(f.getFromDate(), f.getToDate(), tz);
        params.addValue("instituteId", f.getInstituteId())
                .addValue("connectedCsv", connectedCsv(settings))
                .addValue("scopeCsv", scopeCsv, Types.VARCHAR)
                .addValue("fromUtc", w.fromUtc(), Types.TIMESTAMP)
                .addValue("toUtc", w.toUtc(), Types.TIMESTAMP);

        StringBuilder sb = new StringBuilder("""
                WHERE tcl.institute_id = :instituteId
                  AND COALESCE(tcl.start_time, tcl.created_at) >= :fromUtc
                  AND COALESCE(tcl.start_time, tcl.created_at) < :toUtc
                  AND (:scopeCsv IS NULL OR tcl.counsellor_user_id = ANY(STRING_TO_ARRAY(:scopeCsv, ',')))
                """);

        if (notBlank(f.getDirection())) {
            sb.append(" AND tcl.direction = :direction");
            params.addValue("direction", f.getDirection().trim().toUpperCase());
        }
        if (f.getStatuses() != null && !f.getStatuses().isEmpty()) {
            sb.append(" AND tcl.status IN (:statuses)");
            params.addValue("statuses", f.getStatuses());
        }
        if (notBlank(f.getProviderType())) {
            sb.append(" AND tcl.provider_type = :providerType");
            params.addValue("providerType", f.getProviderType().trim().toUpperCase());
        }
        if (notBlank(f.getCallType())) {
            if ("AI".equalsIgnoreCase(f.getCallType().trim())) {
                sb.append(" AND (acr.acr_id IS NOT NULL OR tcl.provider_type = 'AAVTAAR')");
            } else if ("HUMAN".equalsIgnoreCase(f.getCallType().trim())) {
                sb.append(" AND (acr.acr_id IS NULL AND tcl.provider_type <> 'AAVTAAR')");
            }
        }
        if (f.getDispositionKeys() != null && !f.getDispositionKeys().isEmpty()) {
            sb.append(" AND tcl.disposition_key IN (:dispositionKeys)");
            params.addValue("dispositionKeys", f.getDispositionKeys());
        }
        if (notBlank(f.getFromNumber())) {
            sb.append(" AND RIGHT(regexp_replace(tcl.from_number, '[^0-9]', '', 'g'), 10)"
                    + " = RIGHT(regexp_replace(:fromNumber, '[^0-9]', '', 'g'), 10)");
            params.addValue("fromNumber", f.getFromNumber().trim());
        }
        if (notBlank(f.getToNumber())) {
            sb.append(" AND RIGHT(regexp_replace(tcl.to_number, '[^0-9]', '', 'g'), 10)"
                    + " = RIGHT(regexp_replace(:toNumber, '[^0-9]', '', 'g'), 10)");
            params.addValue("toNumber", f.getToNumber().trim());
        }
        if (notBlank(f.getLeadName())) {
            sb.append(" AND ar.parent_name ILIKE :leadName");
            params.addValue("leadName", "%" + f.getLeadName().trim() + "%");
        }
        if (f.getHasRecording() != null) {
            sb.append(f.getHasRecording()
                    ? " AND tcl.recording_storage_key IS NOT NULL"
                    : " AND tcl.recording_storage_key IS NULL");
        }
        if (includeChips && Boolean.TRUE.equals(f.getMissedInbound())) {
            sb.append(" AND tcl.direction = 'INBOUND'"
                    + " AND tcl.status IN ('NO_ANSWER','BUSY','FAILED','CANCELLED')");
            sb.append(NO_LATER_CONNECT);
        }
        if (includeChips && Boolean.TRUE.equals(f.getCallbacksDue())) {
            sb.append(" AND COALESCE(tcl.callback_at, acr.ai_callback_at AT TIME ZONE 'UTC') IS NOT NULL"
                    + " AND COALESCE(tcl.callback_at, acr.ai_callback_at AT TIME ZONE 'UTC') <= :nowUtc");
            sb.append(NO_LATER_CONNECT);
            params.addValue("nowUtc", LocalDateTime.now(ZoneOffset.UTC), Types.TIMESTAMP);
        }
        return sb.toString();
    }

    /** Whitelisted sort — never interpolate user input into SQL. */
    private String orderBy(CallSearchFilterDTO f) {
        String col = switch (f.getSortBy() == null ? "" : f.getSortBy().trim().toUpperCase()) {
            case "DURATION" -> "tcl.duration_seconds";
            case "STATUS" -> "tcl.status";
            default -> "COALESCE(tcl.start_time, tcl.created_at)";
        };
        String dir = "ASC".equalsIgnoreCase(f.getSortDirection()) ? "ASC" : "DESC";
        return " ORDER BY " + col + " " + dir + " NULLS LAST, tcl.id DESC";
    }

    // ── helpers (mirrors CallingReportService) ──────────────────────────────────

    private record Window(LocalDateTime fromUtc, LocalDateTime toUtc) {
    }

    private Window resolveWindow(String fromDate, String toDate, ZoneId tz) {
        LocalDate today = LocalDate.now(tz);
        LocalDate to = parseOr(toDate, today);
        LocalDate from = parseOr(fromDate, to.minusDays(DEFAULT_RANGE_DAYS - 1L));
        return new Window(
                from.atStartOfDay(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime(),
                to.plusDays(1).atStartOfDay(tz).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
    }

    private ZoneId safeZone(LeadReportSettingService.ReportSettings settings) {
        try {
            return ZoneId.of(settings.timezone());
        } catch (Exception e) {
            return FALLBACK_ZONE;
        }
    }

    private static String connectedCsv(LeadReportSettingService.ReportSettings settings) {
        var statuses = settings != null ? settings.connectedCallStatuses() : null;
        if (statuses == null || statuses.isEmpty()) return "COMPLETED";
        return String.join(",", statuses);
    }

    private Map<String, String> fetchNames(Collection<String> userIds) {
        List<String> ids = userIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        Map<String, String> out = new HashMap<>();
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(ids))) {
                if (u != null && u.getId() != null) out.put(u.getId(), u.getFullName());
            }
        } catch (Exception e) {
            log.warn("[CallSearch] counsellor name hydration failed: {}", e.getMessage());
        }
        return out;
    }

    private static String mask(String number, boolean unmask) {
        if (unmask || number == null || number.length() < 4) return number;
        String tail = number.substring(number.length() - 4);
        return "*".repeat(number.length() - 4) + tail;
    }

    private static Integer getNullableInt(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        int v = rs.getInt(col);
        return rs.wasNull() ? null : v;
    }

    private static LocalDate parseOr(String iso, LocalDate fallback) {
        if (iso == null || iso.isBlank()) return fallback;
        try {
            return LocalDate.parse(iso.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String trimToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
