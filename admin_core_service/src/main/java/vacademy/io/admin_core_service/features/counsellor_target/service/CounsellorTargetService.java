package vacademy.io.admin_core_service.features.counsellor_target.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.CounselorPerformanceDTO;
import vacademy.io.admin_core_service.features.audience.service.LeadReportService;
import vacademy.io.admin_core_service.features.audience.service.LeadReportSettingService;
import vacademy.io.admin_core_service.features.counsellor_target.dto.CounsellorTargetDTO;
import vacademy.io.admin_core_service.features.counsellor_target.dto.CounsellorTargetProgressDTO;
import vacademy.io.admin_core_service.features.counsellor_target.dto.CounsellorTargetProgressRequest;
import vacademy.io.admin_core_service.features.counsellor_target.enums.TargetMetric;
import vacademy.io.admin_core_service.features.counsellor_target.enums.TargetPeriodType;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.LeadWorkbenchSettingService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/**
 * Computes target-vs-completed for the Counsellor Workbench dashboard.
 *
 * Storage of the targets themselves lives in {@link LeadWorkbenchSettingService}
 * (institute setting JSON). This service owns the read-side orchestration:
 * resolve the window from the timeline selector, pull each counsellor's
 * "completed" numbers from the same live queries the Reports Center uses, and
 * pair them with the configured targets.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorTargetService {

    private final LeadWorkbenchSettingService settingService;
    private final LeadReportService leadReportService;
    private final LeadReportSettingService reportSettingService;
    private final NamedParameterJdbcTemplate jdbc;

    /** Per-counsellor calls placed in the window (window column matches CallingReportService). */
    private static final String CALLS_COUNT_SQL = """
            SELECT tcl.counsellor_user_id AS uid, COUNT(*) AS n
            FROM telephony_call_log tcl
            WHERE tcl.institute_id = :instituteId
              AND tcl.counsellor_user_id = ANY(STRING_TO_ARRAY(:csv, ','))
              AND COALESCE(tcl.start_time, tcl.created_at) >= :fromTs
              AND COALESCE(tcl.start_time, tcl.created_at) <  :toTs
            GROUP BY tcl.counsellor_user_id
            """;

    @Transactional(readOnly = true)
    public CounsellorTargetProgressDTO getProgress(CounsellorTargetProgressRequest req, String callerUserId) {
        if (!TargetPeriodType.isValid(req.getPeriodType())) {
            throw new VacademyException("Invalid period_type: " + req.getPeriodType());
        }
        List<String> ids = req.getCounsellorUserIds() == null ? List.of()
                : req.getCounsellorUserIds().stream()
                        .filter(s -> s != null && !s.isBlank())
                        .distinct()
                        .toList();

        ZoneId zone = safeZone(req.getInstituteId());
        Window w = resolveWindow(req.getPeriodType(), req.getFromDate(), req.getToDate(), zone);

        if (ids.isEmpty()) {
            return CounsellorTargetProgressDTO.builder()
                    .periodType(req.getPeriodType())
                    .fromDate(w.from.toString())
                    .toDate(w.to.toString())
                    .rows(List.of())
                    .build();
        }

        // Configured targets for the whole roster page.
        Map<String, List<CounsellorTargetDTO>> targetsByUser =
                settingService.getTargetsBatch(req.getInstituteId(), ids);

        // Completed: conversions + leads from the canonical per-counsellor report…
        Map<String, long[]> convLeads = new HashMap<>(); // uid -> [conversions, leadsAssigned]
        CounselorPerformanceDTO perf = leadReportService.getCounselorPerformance(
                req.getInstituteId(), w.from.toString(), w.to.toString(),
                null, null, null, null, callerUserId);
        if (perf.getRows() != null) {
            for (CounselorPerformanceDTO.Row r : perf.getRows()) {
                convLeads.put(r.getCounselorId(), new long[]{r.getConversions(), r.getLeadsAssigned()});
            }
        }
        // …and calls from telephony_call_log over the same window.
        Map<String, Long> callsByUser = countCalls(req.getInstituteId(), ids, w, zone);

        List<CounsellorTargetProgressDTO.Row> rows = new ArrayList<>();
        for (String uid : ids) {
            long[] cl = convLeads.getOrDefault(uid, new long[]{0L, 0L});
            long calls = callsByUser.getOrDefault(uid, 0L);
            List<CounsellorTargetProgressDTO.Item> items = new ArrayList<>();
            for (CounsellorTargetDTO t : targetsByUser.getOrDefault(uid, List.of())) {
                if (!matchesWindow(t, req.getPeriodType(), w)) continue;
                long completed = completedFor(t.getMetric(), cl, calls);
                Integer target = t.getTargetValue();
                Double pct = (target != null && target > 0)
                        ? Math.round(completed * 10000.0 / target) / 100.0
                        : null;
                items.add(CounsellorTargetProgressDTO.Item.builder()
                        .metric(t.getMetric())
                        .targetValue(target)
                        .completed(completed)
                        .attainmentPct(pct)
                        .build());
            }
            rows.add(CounsellorTargetProgressDTO.Row.builder()
                    .counsellorUserId(uid)
                    .items(items)
                    .build());
        }

        return CounsellorTargetProgressDTO.builder()
                .periodType(req.getPeriodType())
                .fromDate(w.from.toString())
                .toDate(w.to.toString())
                .rows(rows)
                .build();
    }

    // ── helpers ──────────────────────────────────────────────────────

    private long completedFor(String metric, long[] convLeads, long calls) {
        if (TargetMetric.CONVERSIONS.name().equals(metric)) return convLeads[0];
        if (TargetMetric.LEADS_ASSIGNED.name().equals(metric)) return convLeads[1];
        if (TargetMetric.CALLS_MADE.name().equals(metric)) return calls;
        return 0L;
    }

    /** A target belongs to the selected window: recurring by period, custom by exact range. */
    private boolean matchesWindow(CounsellorTargetDTO t, String periodType, Window w) {
        if (TargetPeriodType.CUSTOM.name().equals(periodType)) {
            return TargetPeriodType.CUSTOM.name().equals(t.getPeriodType())
                    && w.from.toString().equals(t.getPeriodStart())
                    && w.to.toString().equals(t.getPeriodEnd());
        }
        return periodType.equals(t.getPeriodType());
    }

    private Map<String, Long> countCalls(String instituteId, List<String> ids, Window w, ZoneId zone) {
        Map<String, Long> out = new HashMap<>();
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("instituteId", instituteId)
                .addValue("csv", String.join(",", ids))
                .addValue("fromTs", toUtc(w.from, zone))
                .addValue("toTs", toUtc(w.to.plusDays(1), zone));
        jdbc.query(CALLS_COUNT_SQL, p, rs -> {
            out.put(rs.getString("uid"), rs.getLong("n"));
        });
        return out;
    }

    private Timestamp toUtc(LocalDate d, ZoneId zone) {
        return Timestamp.valueOf(d.atStartOfDay(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
    }

    private ZoneId safeZone(String instituteId) {
        try {
            return ZoneId.of(reportSettingService.get(instituteId).timezone());
        } catch (Exception e) {
            return ZoneId.of("Asia/Kolkata");
        }
    }

    /** Resolve the timeline selector to concrete institute-TZ dates. */
    private Window resolveWindow(String periodType, String fromDate, String toDate, ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        if (TargetPeriodType.CUSTOM.name().equals(periodType)) {
            LocalDate from = parse(fromDate);
            LocalDate to = parse(toDate);
            if (from == null || to == null) {
                throw new VacademyException("CUSTOM period requires from_date and to_date");
            }
            if (to.isBefore(from)) throw new VacademyException("to_date must be >= from_date");
            return new Window(from, to);
        }
        // WEEK / MONTH: use the supplied dates if present, else the current period.
        LocalDate from = parse(fromDate);
        LocalDate to = parse(toDate);
        if (from != null && to != null) return new Window(from, to);
        if (TargetPeriodType.WEEK.name().equals(periodType)) {
            LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            return new Window(monday, monday.plusDays(6));
        }
        // MONTH
        return new Window(today.withDayOfMonth(1), today.with(TemporalAdjusters.lastDayOfMonth()));
    }

    private LocalDate parse(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return LocalDate.parse(iso.trim());
        } catch (Exception e) {
            return null;
        }
    }

    /** Resolved institute-TZ window (inclusive dates). Public fields to keep call sites terse. */
    private static final class Window {
        final LocalDate from;
        final LocalDate to;
        Window(LocalDate from, LocalDate to) {
            this.from = from;
            this.to = to;
        }
    }
}
