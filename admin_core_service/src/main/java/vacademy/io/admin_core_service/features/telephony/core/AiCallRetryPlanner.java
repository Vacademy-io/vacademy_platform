package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;
import vacademy.io.admin_core_service.features.audience.repository.UserLeadProfileRepository;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingSettingsPojo;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Decides what the CALL_AI node should do for a lead on each (re)entry of the
 * pause/resume retry loop: dial now, defer (re-check later), or stop. All limits
 * come from the institute's AI_CALLING_SETTING — nothing is hardcoded.
 *
 * <p>Order: AI calling off / lead assigned / out of total retries → STOP;
 * outside the calling shifts or hit today's per-lead cap → DEFER; otherwise DIAL.
 */
@Service
@RequiredArgsConstructor
public class AiCallRetryPlanner {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    public enum Action { DIAL, DEFER, STOP }

    /** {@code resumeAt} = when to resume after a DIAL (gap) or a DEFER (recheck); null for STOP. */
    public record Plan(Action action, Instant resumeAt, String reason) {}

    private final AiCallingSettingsService settingsService;
    private final UserLeadProfileRepository userLeadProfileRepository;

    /** Gap before the next attempt after a dial. */
    @Value("${aavtaar.redialer.gap-minutes:120}")
    private long gapMinutes;

    /** Wait before re-checking a deferred lead (outside shift / day cap reached). */
    @Value("${aavtaar.redialer.recheck-minutes:30}")
    private long recheckMinutes;

    public Plan plan(String instituteId, String userId, int attempts, int callsToday, String callsDay) {
        AiCallingSettingsPojo s = settingsService.get(instituteId);
        if (s == null || !s.isEnabled()) return new Plan(Action.STOP, null, "ai_calling_disabled");
        if (leadAlreadyAssigned(userId, instituteId)) return new Plan(Action.STOP, null, "assigned");

        int maxRetries = Math.max(1, s.getMaxRetries());
        if (attempts >= maxRetries) return new Plan(Action.STOP, null, "exhausted");

        ZoneId tz = resolveZone(s.getTimezone());
        Instant now = Instant.now();
        Instant recheck = now.plus(recheckMinutes, ChronoUnit.MINUTES);

        if (!withinAnyShift(now, s.getCallingShifts(), tz)) {
            return new Plan(Action.DEFER, recheck, "outside_shift");
        }
        LocalDate today = LocalDate.now(tz);
        int effectiveToday = today.toString().equals(callsDay) ? callsToday : 0;
        if (effectiveToday >= Math.max(1, s.getMaxCallsPerDayPerLead())) {
            return new Plan(Action.DEFER, recheck, "day_cap");
        }

        return new Plan(Action.DIAL, now.plus(gapMinutes, ChronoUnit.MINUTES), "dial");
    }

    private boolean leadAlreadyAssigned(String userId, String instituteId) {
        if (isBlank(userId) || isBlank(instituteId)) return false;
        return userLeadProfileRepository.findByUserIdAndInstituteId(userId, instituteId)
                .map(UserLeadProfile::getAssignedCounselorId)
                .filter(id -> id != null && !id.isBlank())
                .isPresent();
    }

    /** Inside any [start,end] shift (institute tz); handles windows wrapping midnight. */
    private boolean withinAnyShift(Instant now, List<AiCallingSettingsPojo.Shift> shifts, ZoneId tz) {
        if (shifts == null || shifts.isEmpty()) return true;
        LocalTime t = LocalTime.ofInstant(now, tz);
        for (AiCallingSettingsPojo.Shift sh : shifts) {
            LocalTime start = parseTime(sh.getStart());
            LocalTime end = parseTime(sh.getEnd());
            if (start == null || end == null) continue;
            if (start.equals(end)) return true; // 24h
            boolean within = start.isBefore(end)
                    ? (!t.isBefore(start) && !t.isAfter(end))
                    : (!t.isBefore(start) || !t.isAfter(end));
            if (within) return true;
        }
        return false;
    }

    private LocalTime parseTime(String hhmm) {
        if (isBlank(hhmm)) return null;
        try {
            return LocalTime.parse(hhmm.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private ZoneId resolveZone(String tz) {
        if (isBlank(tz)) return IST;
        try {
            return ZoneId.of(tz.trim());
        } catch (Exception e) {
            return IST;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
