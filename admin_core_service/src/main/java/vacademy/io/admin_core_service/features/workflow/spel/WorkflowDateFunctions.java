package vacademy.io.admin_core_service.features.workflow.spel;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.util.WorkflowDateUtil;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoField;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Date helpers exposed to workflow SpEL expressions as {@code #dates}. Registered once in
 * {@link SpelEvaluator}, so every node type (TRANSFORM, SEND_WHATSAPP templateVars, SEND_EMAIL,
 * CONDITION, ...) can compute an anchor date from config instead of relying on hardcoded Java.
 *
 * <p>Example — announce the drip's start day in a welcome message, no code change to switch
 * weekday/format/timezone:
 * <pre>
 *   #dates.nextWeekday('MONDAY', 'Asia/Kolkata', 'do MMMM')   -&gt; "3rd August"
 *   #dates.nextWeekday('TUESDAY', 'Asia/Kolkata', 'EEEE, do MMM')
 * </pre>
 *
 * <p>Pattern is a standard {@link java.time.format.DateTimeFormatter} pattern, with one addition:
 * the token {@code do} renders the day-of-month with an English ordinal suffix (1st, 2nd, 3rd...).
 */
@Component
public class WorkflowDateFunctions {

    /** 1 -> "1st", 2 -> "2nd", ... 31 -> "31st"; used to render the {@code do} pattern token. */
    private static final Map<Long, String> ORDINAL_DAYS = buildOrdinalDays();

    /**
     * Next occurrence of {@code day}, strictly after today (today is never returned), formatted
     * with {@code pattern} in {@code zone}. This is the common case for a "starts next &lt;weekday&gt;"
     * announcement and matches the DELAY node's default (includeSameDay=false).
     */
    public String nextWeekday(String day, String zone, String pattern) {
        return nextWeekday(day, "00:00", zone, pattern, false);
    }

    /**
     * Next occurrence with explicit time-of-day and same-day handling. {@code time} only matters
     * when {@code includeSameDay} is true (it decides whether today still qualifies).
     */
    public String nextWeekday(String day, String time, String zone, String pattern,
                              boolean includeSameDay) {
        ZoneId z = ZoneId.of(zone);
        ZonedDateTime target = WorkflowDateUtil.nextOccurrence(
                ZonedDateTime.now(z),
                DayOfWeek.valueOf(day.trim().toUpperCase(Locale.ENGLISH)),
                LocalTime.parse(time.trim()),
                includeSameDay);
        return format(target.toLocalDate(), pattern);
    }

    /** Format a date with a standard pattern, treating the literal token {@code do} as ordinal day. */
    private String format(LocalDate date, String pattern) {
        DateTimeFormatterBuilder builder = new DateTimeFormatterBuilder();
        // Split on the ordinal-day token; surrounding segments are ordinary DateTimeFormatter patterns.
        String[] segments = pattern.split("do", -1);
        for (int i = 0; i < segments.length; i++) {
            if (!segments[i].isEmpty()) {
                builder.appendPattern(segments[i]);
            }
            if (i < segments.length - 1) {
                builder.appendText(ChronoField.DAY_OF_MONTH, ORDINAL_DAYS);
            }
        }
        return builder.toFormatter(Locale.ENGLISH).format(date);
    }

    private static Map<Long, String> buildOrdinalDays() {
        Map<Long, String> map = new HashMap<>();
        for (long d = 1; d <= 31; d++) {
            map.put(d, d + ordinalSuffix((int) d));
        }
        return map;
    }

    private static String ordinalSuffix(int day) {
        if (day >= 11 && day <= 13) {
            return "th";
        }
        return switch (day % 10) {
            case 1 -> "st";
            case 2 -> "nd";
            case 3 -> "rd";
            default -> "th";
        };
    }
}
