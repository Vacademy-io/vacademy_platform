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
 * Named ReportING-, not Report-: features/audience/service already has a
 * ReportScopeResolver, and Spring derives bean names from the simple class name,
 * so two of them is a ConflictingBeanDefinitionException at startup — the whole
 * service refuses to boot. Do not shorten this name.
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
public class ReportingScopeResolver {

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
            // Refuse rather than truncate. Truncation is ordered by label, so the
            // same tail of batches would be silently excluded from every run
            // forever — those cohorts would simply never be reported on and nobody
            // would notice. Failing the schedule is visible, and /scope-preview
            // exists so an admin never reaches this in the first place.
            throw new IllegalStateException(String.format(
                    "Schedule %s resolves to %d documents, above the %d limit. "
                            + "Narrow the scope — check /reporting/v1/scope-preview before saving.",
                    schedule.getId(), scopes.size(), MAX_DOCUMENTS_PER_RUN));
        }
        return scopes;
    }

    /**
     * How many documents this schedule produces per run, and per month. Drives the
     * pre-save warning and, from Phase 2, the credit projection.
     */
    public Preview preview(String instituteId, ReportScheduleConfig schedule,
                           double perDocumentCredits) {
        List<Scope> scopes = resolveUncapped(instituteId, schedule);
        int perRun = scopes.size();
        int runsPerMonth = switch (nullSafe(schedule.getFrequency())) {
            case "daily" -> 30;
            case "monthly" -> 1;
            default -> 4;
        };
        // Cost is quoted per DOCUMENT and then multiplied out, because that is how it
        // is actually charged — the surprise this preview exists to prevent is scope,
        // not price: "every subject, daily" is 1,042 documents a run.
        double perDoc = perDocumentCredits;
        return new Preview(perRun, runsPerMonth, perRun * runsPerMonth,
                perRun > MAX_DOCUMENTS_PER_RUN,
                scopes.stream().limit(10).map(Scope::label).toList(),
                perDoc, perDoc * perRun, perDoc * perRun * runsPerMonth);
    }

    public record Preview(int documentsPerRun, int runsPerMonth, int documentsPerMonth,
                          boolean exceedsCap, List<String> sampleLabels,
                          double creditsPerDocument, double creditsPerRun,
                          double creditsPerMonth) {}

    public record Option(String id, String label) {}

    /** {@code total} is the full match count; {@code options} may be capped. */
    public record Options(int total, boolean truncated, List<Option> options) {}

    /**
     * The pickable scopes for a type, so a schedule can name the batches it wants
     * instead of meaning "all of them".
     *
     * This exists because an empty {@code scopeIds} is interpreted as "every one",
     * and at a real institute every batch is 661 documents — over the per-run cap,
     * so the schedule throws rather than sends. Without a picker, any scope other
     * than INSTITUTE is unusable, which made the whole scoping feature theoretical.
     *
     * Filtering happens in Java rather than SQL: the candidate list is already
     * institute-scoped and at most a few thousand rows, and reusing the same
     * queries as the real fan-out guarantees the picker offers exactly what a run
     * would resolve. A picker that could offer a scope the runner then rejects
     * would be worse than no picker.
     */
    public Options options(String instituteId, String scopeType, String query, int limit) {
        ReportContext.ScopeType type = parseType(scopeType);
        if (type == ReportContext.ScopeType.INSTITUTE) {
            return new Options(0, false, List.of());
        }
        List<Scope> all = lookup(sqlFor(type), instituteId, List.of(), type);
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<Option> matched = all.stream()
                .filter(sc -> q.isEmpty()
                        || (sc.label() != null && sc.label().toLowerCase(Locale.ROOT).contains(q)))
                .map(sc -> new Option(sc.id(), sc.label()))
                .toList();
        int cap = Math.max(1, Math.min(limit, 200));
        return new Options(matched.size(), matched.size() > cap,
                matched.stream().limit(cap).toList());
    }

    private String sqlFor(ReportContext.ScopeType type) {
        return switch (type) {
            case BATCH -> BATCH_SQL;
            case SUBJECT -> SUBJECT_SQL;
            case FACULTY -> FACULTY_SQL;
            case INSTITUTE -> throw new IllegalArgumentException("institute scope has no options");
        };
    }

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

    /**
     * Batch labels must be DISTINGUISHABLE, not merely present. This label is the
     * document's heading and its subject line, so when a schedule fans out per
     * batch, a duplicated label means the recipient gets several reports they
     * cannot tell apart.
     *
     * That is the normal case, not an edge case: {@code package_session.name} is
     * null across every institute checked, so the label falls back to the package
     * name — and one institute has four distinct batches all called "Premium Pro
     * Group 2". Level and academic year are what separate them, appended only when
     * they are not already part of the name, so batches that DO name their class
     * don't come out as "Summer Sprint - Class 6 · Class 6 · 2026-27".
     */
    private static final String BATCH_SQL = """
            SELECT DISTINCT ps.id AS id, lbl.label AS label
            FROM package_session ps
            JOIN package_institute pi ON pi.package_id = ps.package_id
            LEFT JOIN package p ON p.id = ps.package_id
            LEFT JOIN level l ON l.id = ps.level_id
            LEFT JOIN session sn ON sn.id = ps.session_id
            LEFT JOIN LATERAL (
                SELECT CASE
                         WHEN sn.session_name IS NULL OR btrim(sn.session_name) = ''
                              OR wl ILIKE '%' || sn.session_name || '%'
                         THEN wl ELSE wl || ' · ' || sn.session_name END AS label
                FROM (
                    SELECT CASE
                             WHEN l.level_name IS NULL OR btrim(l.level_name) = ''
                                  OR b ILIKE '%' || l.level_name || '%'
                             THEN b ELSE b || ' · ' || l.level_name END AS wl
                    FROM (SELECT COALESCE(NULLIF(btrim(ps.name), ''),
                                          p.package_name) AS b) base
                ) withLevel
            ) lbl ON TRUE
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
