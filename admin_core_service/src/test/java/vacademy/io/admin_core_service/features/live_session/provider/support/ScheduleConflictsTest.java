package vacademy.io.admin_core_service.features.live_session.provider.support;

import org.junit.jupiter.api.Test;
import vacademy.io.common.meeting.dto.UserScheduleAvailabilityDTO.ConflictingSessionDTO;

import java.sql.Time;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ScheduleConflictsTest {

    @Test
    void mapsRowsToConflictsWithEpochMillisInZone() {
        java.sql.Date date = java.sql.Date.valueOf(LocalDate.of(2026, 6, 10));
        Object[] row = {"sess-9", "sched-9", "Physics",
                date, Time.valueOf(LocalTime.of(10, 0)), Time.valueOf(LocalTime.of(11, 0))};

        List<ConflictingSessionDTO> conflicts = ScheduleConflicts.map(List.<Object[]>of(row), ScheduleConflicts.DEFAULT_ZONE);

        assertEquals(1, conflicts.size());
        ConflictingSessionDTO c = conflicts.get(0);
        assertEquals("sched-9", c.getMeetingKey());
        assertEquals("Physics", c.getTopic());
        long expectedStart = LocalDateTime.of(2026, 6, 10, 10, 0)
                .atZone(ZoneId.of("Asia/Kolkata")).toInstant().toEpochMilli();
        assertEquals(expectedStart, c.getStartTimeMillisec());
        assertEquals(expectedStart + 60 * 60_000L, c.getEndTimeMillisec());
    }

    @Test
    void nullOrEmptyRowsYieldEmpty() {
        assertTrue(ScheduleConflicts.map(null, ScheduleConflicts.DEFAULT_ZONE).isEmpty());
        assertTrue(ScheduleConflicts.map(List.of(), ScheduleConflicts.DEFAULT_ZONE).isEmpty());
    }
}
