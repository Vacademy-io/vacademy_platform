package vacademy.io.admin_core_service.features.reporting.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;
import vacademy.io.admin_core_service.features.reporting.spi.ReportContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Expands a schedule into the documents it will actually produce.
 *
 * This is where the fan-out lives, and fan-out is the expensive dimension: a
 * subject-scoped schedule at a large institute is not one report, it is thirty —
 * thirty computations, thirty emails, and once Phase 2 wires billing, thirty
 * charges. {@link #preview} exists so an admin is told that number <em>before</em>
 * they save, rather than discovering it on the credit ledger.
 *
 * An empty scopeIds list means "every scope of this type in the institute", which
 * is the setting most likely to surprise someone — hence the cap and the loud log.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportScopeResolver {

    /**
     * Refuse to fan out beyond this in one schedule. A 200-batch institute selecting
     * "every batch, daily" would otherwise generate 6,000 documents a month. The cap
     * is a backstop, not the UX — the preview is what should stop them first.
     */
    public static final int MAX_DOCUMENTS_PER_RUN = 50;

    private final JdbcTemplate jdbcTemplate;

    /** One entry per document the schedule will produce. */
    public record Scope(ReportContext.ScopeType type, String id, String label) {}

    public List<Scope> resolve(String instituteId, ReportScheduleConfig schedule) {
        ReportContext.ScopeType type = parseType(schedule.getScopeType());
        List<String> ids = schedule.getScopeIds() == null ? List.of() : schedule.getScopeIds();

        List<Scope> scopes = switch (type) {
            case INSTITUTE -> List.of(new Scope(ReportContext.ScopeType.INSTITUTE, null,
                    schedule.getName() == null ? "Institute report" : schedule.getName()));
            case BATCH -> lookup(BATCH_SQL, instituteId, ids, ReportContext.ScopeType.BATCH);
            case SUBJECT -> lookup(SUBJECT_SQL, instituteId, ids, ReportContext.ScopeType.SUBJECT);
            case FACULTY -> lookup(FACULTY_SQL, instituteId, ids, ReportContext.ScopeType.FACULTY);
        };

        if (scopes.size() > MAX_DOCUMENTS_PER_RUN) {
            log.warn("[reporting] schedule {} for institute {} resolved to {} documents — capping at {}. "
                            + "The configuration screen should have refused this.",
                    schedule.getId(), instituteId, scopes.size(), MAX_DOCUMENTS_PER_RUN);
            return scopes.subList(0, MAX_DOCUMENTS_PER_RUN);
        }
        return scopes;
    }

    /**
     * How many documents this schedule produces per run, and per month. Drives the
     * pre-save warning and, from Phase 2, the credit projection.
     */
    public Preview preview(String instituteId, ReportScheduleConfig schedule) {
        List<Scope> scopes = resolveUncapped(instituteId, schedule);
        int perRun = scopes.size();
        int runsPerMonth = switch (nullSafe(schedule.getFrequency())) {
            case "daily" -> 30;
            case "monthly" -> 1;
            default -> 4;
        };
        return new Preview(perRun, runsPerMonth, perRun * runsPerMonth,
                perRun > MAX_DOCUMENTS_PER_RUN,
                scopes.stream().limit(10).map(Scope::label).toList());
    }

    public record Preview(int documentsPerRun, int runsPerMonth, int documentsPerMonth,
                          boolean exceedsCap, List<String> sampleLabels) {}

    private List<Scope> resolveUncapped(String instituteId, ReportScheduleConfig schedule) {
        ReportContext.ScopeType type = parseType(schedule.getScopeType());
        List<String> ids = schedule.getScopeIds() == null ? List.of() : schedule.getScopeIds();
        return switch (type) {
            case INSTITUTE -> List.of(new Scope(ReportContext.ScopeType.INSTITUTE, null, "Institute report"));
            case BATCH -> lookup(BATCH_SQL, instituteId, ids, ReportContext.ScopeType.BATCH);
            case SUBJECT -> lookup(SUBJECT_SQL, instituteId, ids, ReportContext.ScopeType.SUBJECT);
            case FACULTY -> lookup(FACULTY_SQL, instituteId, ids, ReportContext.ScopeType.FACULTY);
        };
    }

    private List<Scope> lookup(String sql, String instituteId, List<String> ids, ReportContext.ScopeType type) {
        try {
            // An empty selection means "all of them". Passing the emptiness as a flag
            // keeps this to one query rather than two code paths that can drift.
            boolean all = ids.isEmpty();
            String idCsv = all ? "" : String.join(",", ids);
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, instituteId, all, idCsv);
            List<Scope> out = new ArrayList<>(rows.size());
            for (Map<String, Object> r : rows) {
                String id = String.valueOf(r.get("id"));
                Object label = r.get("label");
                out.add(new Scope(type, id, label == null || String.valueOf(label).isBlank()
                        ? type.name().toLowerCase(Locale.ROOT) + " " + id : String.valueOf(label)));
            }
            return out;
        } catch (Exception e) {
            // Fail loudly. Silently returning no scopes would look like "nothing due"
            // and the institute would simply stop receiving reports.
            throw new RuntimeException("Could not resolve " + type + " scope for institute " + instituteId, e);
        }
    }

    private ReportContext.ScopeType parseType(String s) {
        try {
            return ReportContext.ScopeType.valueOf(nullSafe(s).toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return ReportContext.ScopeType.INSTITUTE;
        }
    }

    private String nullSafe(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    // Parameters for each: instituteId, allFlag, comma-separated ids.
    private static final String BATCH_SQL = """
            SELECT DISTINCT ps.id AS id,
                   COALESCE(NULLIF(ps.name, ''), p.package_name) AS label
            FROM package_session ps
            JOIN package_institute pi ON pi.package_id = ps.package_id
            LEFT JOIN package p ON p.id = ps.package_id
            WHERE pi.institute_id = ?
              AND ps.status <> 'DELETED'
              AND (CAST(? AS boolean) OR ps.id = ANY (string_to_array(?, ',')))
            ORDER BY label
            """;

    private static final String SUBJECT_SQL = """
            SELECT DISTINCT s.id AS id, s.subject_name AS label
            FROM subject s
            -- subject_session.session_id holds a PACKAGE_SESSION id despite the
            -- column name (6,588/6,588 rows join that way; only 707 match
            -- package_session.session_id). The obvious-looking
            -- subject_chapter_module_and_package_session_mapping is not usable
            -- here — it has 9 rows across a single institute.
            JOIN subject_session ss ON ss.subject_id = s.id
            JOIN package_session ps ON ps.id = ss.session_id
            JOIN package_institute pi ON pi.package_id = ps.package_id
            WHERE pi.institute_id = ?
              AND s.status <> 'DELETED'
              AND (CAST(? AS boolean) OR s.id = ANY (string_to_array(?, ',')))
            ORDER BY label
            """;

    private static final String FACULTY_SQL = """
            SELECT DISTINCT f.user_id AS id, MAX(f.name) AS label
            FROM faculty_subject_package_session_mapping f
            JOIN package_session ps ON ps.id = f.package_session_id
            JOIN package_institute pi ON pi.package_id = ps.package_id
            WHERE pi.institute_id = ?
              AND f.status <> 'DELETED'
              AND (CAST(? AS boolean) OR f.user_id = ANY (string_to_array(?, ',')))
            GROUP BY f.user_id
            ORDER BY label
            """;
}
