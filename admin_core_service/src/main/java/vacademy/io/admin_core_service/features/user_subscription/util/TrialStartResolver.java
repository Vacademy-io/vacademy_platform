package vacademy.io.admin_core_service.features.user_subscription.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.TextStyle;
import java.util.Locale;

import vacademy.io.admin_core_service.features.workflow.util.WorkflowDateUtil;

/**
 * Where a free trial's clock starts, read from the invite rather than assumed.
 *
 * <p>An institute whose classes begin on a fixed weekday wants the trial to start on
 * the first class day, not at the moment of signup — otherwise someone enrolling on a
 * Wednesday is charged after only nine days of actual classes. That weekday lives in
 * the invite's {@code AUTOPAY_SETTING.TRIAL_STARTS_ON}.
 *
 * <p>Both the billing anchor (UserPlanService, which sets {@code next_charge_at}) and the
 * start-date label announced in welcome messages resolve through here, over the same
 * {@link WorkflowDateUtil#nextOccurrence} the drip's DELAY node uses. One function decides
 * the date, so what a learner is told and when they are charged cannot disagree.
 */
public final class TrialStartResolver {

    /**
     * Used for the announced start-date label when an invite names no weekday, so the
     * long-standing {@code nextMonday} template variable keeps its meaning. The billing
     * anchor has no such default: absent configuration, a trial starts immediately.
     */
    public static final DayOfWeek DEFAULT_LABEL_DAY = DayOfWeek.MONDAY;

    private TrialStartResolver() {
    }

    /** The configured weekday, or null when the invite doesn't name one. */
    public static DayOfWeek dayFromInvite(String settingJson) {
        return parseDay(readAutopay(settingJson, "TRIAL_STARTS_ON"));
    }

    /** The configured zone, or the server zone when the invite doesn't name one. */
    public static ZoneId zoneFromInvite(String settingJson) {
        return parseZone(readAutopay(settingJson, "TRIAL_TIMEZONE"));
    }

    /**
     * Start-of-day on the next {@code trialStartsOn}, or null to start immediately.
     * Strictly-next: enrolling on the anchor day points at the following week, because
     * that is when the learner's first class runs.
     *
     * <p>Never throws — a malformed weekday or zone is treated as "not configured", so a
     * bad invite setting can't block an enrollment.</p>
     */
    public static ZonedDateTime resolveStart(String trialStartsOn, String timezone) {
        DayOfWeek day = parseDay(trialStartsOn);
        if (day == null) {
            return null;
        }
        return nextStart(day, parseZone(timezone));
    }

    /** Start-of-day on the next occurrence of {@code day}. */
    public static ZonedDateTime nextStart(DayOfWeek day, ZoneId zone) {
        return WorkflowDateUtil.nextOccurrence(
                ZonedDateTime.now(zone), day, LocalTime.MIDNIGHT, /* includeSameDay */ false);
    }

    /** Human label for a start date — "3rd August" — for welcome messages. */
    public static String label(ZonedDateTime start) {
        int day = start.getDayOfMonth();
        String month = start.getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        return day + ordinalSuffix(day) + " " + month;
    }

    private static String ordinalSuffix(int day) {
        if (day >= 11 && day <= 13) {
            return "th";
        }
        switch (day % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    }

    private static DayOfWeek parseDay(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return DayOfWeek.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static ZoneId parseZone(String value) {
        if (value == null || value.isBlank()) {
            return ZoneId.systemDefault();
        }
        try {
            return ZoneId.of(value.trim());
        } catch (Exception e) {
            return ZoneId.systemDefault();
        }
    }

    private static String readAutopay(String settingJson, String field) {
        if (settingJson == null || settingJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = new ObjectMapper().readTree(settingJson)
                    .path("setting").path("AUTOPAY_SETTING").path(field);
            return node.isMissingNode() || node.isNull() ? null : node.asText(null);
        } catch (Exception e) {
            return null;
        }
    }
}
