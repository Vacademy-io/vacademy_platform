package vacademy.io.admin_core_service.features.workflow.util;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

/**
 * Single source of truth for "the next &lt;weekday&gt; at &lt;time&gt; in &lt;zone&gt;" used across the
 * workflow engine. Both the DELAY node (to schedule a pause) and the {@code #dates} SpEL
 * helper (to render a start-date label) compute against this method, so a message that
 * announces a start day can never drift from the delay that actually schedules it.
 */
public final class WorkflowDateUtil {

    private WorkflowDateUtil() {
    }

    /**
     * The next occurrence of {@code day} at {@code time}, relative to {@code now}.
     *
     * <p>Strictly-next by default: if {@code now} already falls on {@code day}, the result is
     * the FOLLOWING week's occurrence — matching the DELAY node's {@code includeSameDay=false}
     * semantics (enrolling on a Monday points at next Monday, because the first class only runs
     * next Monday too). When {@code includeSameDay} is true and today is {@code day} and the
     * target time is still ahead of {@code now}, today's occurrence is returned instead.
     *
     * @param now            reference instant (carries the target zone); passed in so the caller
     *                       can reuse the same {@code now} for both the target and a duration,
     *                       and so the method stays pure/testable.
     * @param day            target weekday
     * @param time           target time-of-day
     * @param includeSameDay allow today when today is already {@code day} and {@code time} is ahead
     */
    public static ZonedDateTime nextOccurrence(ZonedDateTime now, DayOfWeek day, LocalTime time,
                                               boolean includeSameDay) {
        ZonedDateTime target = now.with(TemporalAdjusters.next(day)).with(time);
        if (includeSameDay && now.getDayOfWeek() == day) {
            ZonedDateTime todayAtTime = now.with(time);
            if (todayAtTime.isAfter(now)) {
                target = todayAtTime;
            }
        }
        return target;
    }
}
