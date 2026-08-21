package vacademy.io.admin_core_service.features.reporting.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.Optional;

/**
 * Decides whether a schedule is due, and for which window.
 *
 * The whole class exists because of one constraint: <b>the admin_core JVM runs UTC
 * and must keep running UTC</b>, while institutes think in their own zone. Resolving
 * "Monday 8am" or "the last 7 days" against the server clock shifts every boundary
 * by 5.5 hours for an Indian institute — reports would arrive at 1:30pm and cover
 * the wrong week, subtly, forever. So every boundary here is computed in the
 * institute's zone and only then converted to an instant for querying.
 *
 * Due-ness is deliberately coarse: a schedule is due once its local trigger time has
 * passed for the current period, and the idempotency row is what stops it running
 * twice. That way a tick missed to a deploy or a lock timeout still fires late
 * rather than silently skipping the period.
 */
@Service
@Slf4j
public class ReportWindowResolver {

    /** A window, in the institute's zone, resolved to instants. */
    public record Window(Instant start, Instant end, ZoneId zone, String label) {}

    /**
     * @return the window to report on if this schedule is due now, else empty.
     */
    public Optional<Window> resolveIfDue(ReportScheduleConfig schedule, String timezone, Instant now) {
        ZoneId zone = safeZone(timezone);
        ZonedDateTime localNow = now.atZone(zone);
        String freq = schedule.getFrequency() == null ? "weekly" : schedule.getFrequency().toLowerCase(Locale.ROOT);

        return switch (freq) {
            case "daily" -> dailyWindow(schedule, zone, localNow);
            case "monthly" -> monthlyWindow(schedule, zone, localNow);
            default -> weeklyWindow(schedule, zone, localNow);
        };
    }

    private Optional<Window> dailyWindow(ReportScheduleConfig s, ZoneId zone, ZonedDateTime localNow) {
        if (localNow.getHour() < s.getHour()) return Optional.empty();
        LocalDate today = localNow.toLocalDate();
        return Optional.of(window(today.minusDays(1), today, zone, "yesterday"));
    }

    private Optional<Window> weeklyWindow(ReportScheduleConfig s, ZoneId zone, ZonedDateTime localNow) {
        DayOfWeek want = parseDay(s.getDayOfWeek());
        if (localNow.getDayOfWeek() != want) return Optional.empty();
        if (localNow.getHour() < s.getHour()) return Optional.empty();
        LocalDate today = localNow.toLocalDate();
        return Optional.of(window(today.minusDays(7), today, zone, "the last 7 days"));
    }

    private Optional<Window> monthlyWindow(ReportScheduleConfig s, ZoneId zone, ZonedDateTime localNow) {
        // Capped at 28 so the schedule fires in February too. A "31st" schedule that
        // silently skips four months a year is a support ticket waiting to happen.
        int day = Math.min(Math.max(s.getDayOfMonth(), 1), 28);
        if (localNow.getDayOfMonth() != day) return Optional.empty();
        if (localNow.getHour() < s.getHour()) return Optional.empty();
        LocalDate today = localNow.toLocalDate();
        return Optional.of(window(today.minusMonths(1), today, zone, "the last month"));
    }

    private Window window(LocalDate startDate, LocalDate endDate, ZoneId zone, String label) {
        Instant start = LocalDateTime.of(startDate, java.time.LocalTime.MIDNIGHT).atZone(zone).toInstant();
        Instant end = LocalDateTime.of(endDate, java.time.LocalTime.MIDNIGHT).atZone(zone).toInstant();
        return new Window(start, end, zone, label);
    }

    private ZoneId safeZone(String tz) {
        try {
            return ZoneId.of(tz == null || tz.isBlank() ? "Asia/Kolkata" : tz);
        } catch (Exception e) {
            log.warn("[reporting] unknown timezone '{}' — falling back to Asia/Kolkata", tz);
            return ZoneId.of("Asia/Kolkata");
        }
    }

    private DayOfWeek parseDay(String d) {
        try {
            return DayOfWeek.valueOf(d == null ? "MONDAY" : d.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            // Accept the short forms the UI is likely to send.
            return switch (d == null ? "" : d.trim().toUpperCase(Locale.ROOT)) {
                case "TUE" -> DayOfWeek.TUESDAY;
                case "WED" -> DayOfWeek.WEDNESDAY;
                case "THU" -> DayOfWeek.THURSDAY;
                case "FRI" -> DayOfWeek.FRIDAY;
                case "SAT" -> DayOfWeek.SATURDAY;
                case "SUN" -> DayOfWeek.SUNDAY;
                default -> DayOfWeek.MONDAY;
            };
        }
    }
}
