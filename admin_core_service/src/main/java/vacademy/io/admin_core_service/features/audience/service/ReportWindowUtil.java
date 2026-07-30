package vacademy.io.admin_core_service.features.audience.service;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Shared fromDate/toDate window parsing for every Reports Center endpoint, so all report
 * services accept the same two formats (institute-TZ wall clock):
 *
 *   yyyy-MM-dd               — calendar date; both ends inclusive, i.e. the upper bound
 *                              becomes (date + 1 day) 00:00 exclusive (legacy behaviour).
 *   yyyy-MM-dd'T'HH:mm[:ss]  — exact instant; used as-is, the upper bound is EXCLUSIVE.
 *
 * Null/blank/unparseable values fall back exactly like the legacy per-service parseOr:
 * to = today, from = to − (defaultRangeDays − 1). When only `to` carries a time, the
 * from-default anchors on to's DATE so mixing formats stays sane.
 *
 * The half-open [from, to) contract every report query already uses is preserved in both
 * formats — services keep their own Window records and just delegate the parsing here.
 */
public final class ReportWindowUtil {

    private ReportWindowUtil() {
    }

    /** Half-open window [fromUtc, toUtc) as UTC wall-clock LocalDateTimes. */
    public record UtcWindow(LocalDateTime fromUtc, LocalDateTime toUtc) {
        public Timestamp fromTs() {
            return Timestamp.valueOf(fromUtc);
        }

        public Timestamp toTs() {
            return Timestamp.valueOf(toUtc);
        }
    }

    /** Half-open window [from, to) in the given zone's wall clock — NO UTC conversion. */
    public record LocalWindow(LocalDateTime from, LocalDateTime to) {
    }

    /** Resolve and convert to UTC wall-clock bounds (columns store UTC without time zone). */
    public static UtcWindow resolveUtc(String fromRaw, String toRaw, ZoneId zone, int defaultRangeDays) {
        LocalWindow w = resolveLocal(fromRaw, toRaw, zone, defaultRangeDays);
        return new UtcWindow(toUtc(w.from(), zone), toUtc(w.to(), zone));
    }

    /** Resolve in the zone's own wall clock — for legacy queries that never convert to UTC. */
    public static LocalWindow resolveLocal(String fromRaw, String toRaw, ZoneId zone, int defaultRangeDays) {
        LocalDate today = LocalDate.now(zone);

        LocalDateTime toExclusive;
        LocalDate toAnchor; // date the from-side default is computed against
        LocalDateTime toDt = parseDateTime(toRaw);
        if (toDt != null) {
            toExclusive = toDt;
            toAnchor = toDt.toLocalDate();
        } else {
            LocalDate d = parseDate(toRaw, today);
            toExclusive = d.plusDays(1).atStartOfDay();
            toAnchor = d;
        }

        LocalDateTime fromDt = parseDateTime(fromRaw);
        LocalDateTime fromInclusive = fromDt != null ? fromDt
                : parseDate(fromRaw, toAnchor.minusDays(defaultRangeDays - 1L)).atStartOfDay();

        return new LocalWindow(fromInclusive, toExclusive);
    }

    private static LocalDateTime toUtc(LocalDateTime local, ZoneId zone) {
        return local.atZone(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private static LocalDateTime parseDateTime(String s) {
        if (s == null || !s.contains("T")) return null;
        try {
            return LocalDateTime.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static LocalDate parseDate(String s, LocalDate fallback) {
        if (s == null || s.isBlank()) return fallback;
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return fallback;
        }
    }
}
