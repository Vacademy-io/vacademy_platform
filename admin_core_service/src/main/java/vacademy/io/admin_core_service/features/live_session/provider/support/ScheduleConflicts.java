package vacademy.io.admin_core_service.features.live_session.provider.support;

import vacademy.io.common.meeting.dto.UserScheduleAvailabilityDTO.ConflictingSessionDTO;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * Maps {@code session_schedules} overlap query rows into
 * {@link ConflictingSessionDTO}s for the double-booking / availability response.
 *
 * Schedules store wall-clock {@code meeting_date} + {@code start_time}; we resolve
 * them to epoch millis in a fixed zone so the FE can render the conflicting time.
 * {@link #DEFAULT_ZONE} matches the platform default used across the live-session
 * queries (Asia/Kolkata); callers with a known session timezone may pass their own.
 *
 * Row layout (from {@code findOverlappingSchedulesByProviderAccount}):
 * {@code [sessionId, scheduleId, title, meetingDate, startTime, endTime]}.
 */
public final class ScheduleConflicts {

    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Kolkata");

    private ScheduleConflicts() {
    }

    public static List<ConflictingSessionDTO> map(List<Object[]> rows, ZoneId zone) {
        List<ConflictingSessionDTO> conflicts = new ArrayList<>();
        if (rows == null) {
            return conflicts;
        }
        for (Object[] row : rows) {
            Object dateObj = row[3];
            conflicts.add(ConflictingSessionDTO.builder()
                    .meetingKey(asString(row[1]))
                    .topic(asString(row[2]))
                    .startTimeMillisec(toEpochMillis(dateObj, row[4], zone))
                    .endTimeMillisec(toEpochMillis(dateObj, row[5], zone))
                    .build());
        }
        return conflicts;
    }

    static long toEpochMillis(Object dateObj, Object timeObj, ZoneId zone) {
        LocalDate date;
        if (dateObj instanceof java.sql.Date sqlDate) {
            date = sqlDate.toLocalDate();
        } else if (dateObj instanceof java.util.Date utilDate) {
            date = utilDate.toInstant().atZone(zone).toLocalDate();
        } else {
            date = LocalDate.parse(dateObj.toString());
        }
        LocalTime time = LocalTime.MIDNIGHT;
        if (timeObj instanceof java.sql.Time sqlTime) {
            time = sqlTime.toLocalTime();
        } else if (timeObj != null) {
            try {
                time = LocalTime.parse(timeObj.toString());
            } catch (Exception ignored) {
                // leave as midnight
            }
        }
        return LocalDateTime.of(date, time).atZone(zone).toInstant().toEpochMilli();
    }

    private static String asString(Object o) {
        return o != null ? o.toString() : null;
    }
}
