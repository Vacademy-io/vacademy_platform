package vacademy.io.admin_core_service.features.live_session.provider.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.meeting.dto.UserScheduleAvailabilityDTO;

import java.sql.Time;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Focused tests for {@link LiveSessionProviderService#checkAvailabilityForSession}
 * (session-level double-booking). Only the schedule repository is exercised; other
 * constructor deps are unused null mocks.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LiveSessionProviderServiceAvailabilityTest {

    private static final String SESSION_ID = "sess-1";
    private static final String ACCOUNT_ID = "acct-1";

    @Mock private SessionScheduleRepository scheduleRepository;
    @InjectMocks private LiveSessionProviderService service;

    private SessionSchedule row(String id, String status, Time start, Time end) {
        return SessionSchedule.builder()
                .id(id).sessionId(SESSION_ID).status(status)
                .meetingDate(java.sql.Date.valueOf(LocalDate.of(2026, 6, 10)))
                .startTime(start).lastEntryTime(end).build();
    }

    private Object[] conflictRow(String conflictScheduleId) {
        return new Object[]{"other-sess", conflictScheduleId, "Other class",
                java.sql.Date.valueOf(LocalDate.of(2026, 6, 10)),
                Time.valueOf("10:30:00"), Time.valueOf("11:30:00")};
    }

    @Test
    void reportsConflictAndSkipsDeletedOrIncompleteRows() {
        when(scheduleRepository.findBySessionId(SESSION_ID)).thenReturn(List.of(
                row("r1", "LIVE", Time.valueOf("10:00:00"), Time.valueOf("11:00:00")),
                row("r2", "DELETED", Time.valueOf("10:00:00"), Time.valueOf("11:00:00")),
                row("r3", "LIVE", Time.valueOf("10:00:00"), null)));
        when(scheduleRepository.findOverlappingSchedulesByProviderAccount(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.<Object[]>of(conflictRow("other-sched")));

        UserScheduleAvailabilityDTO result = service.checkAvailabilityForSession(SESSION_ID, ACCOUNT_ID);

        assertFalse(result.isAvailable());
        assertEquals(1, result.getConflicts().size());
        assertEquals("other-sched", result.getConflicts().get(0).getMeetingKey());
        // Only the one valid LIVE row with a full time window is queried.
        verify(scheduleRepository, times(1))
                .findOverlappingSchedulesByProviderAccount(any(), any(), any(), any(), any(), any());
    }

    @Test
    void dedupesSameConflictAcrossOccurrences() {
        when(scheduleRepository.findBySessionId(SESSION_ID)).thenReturn(List.of(
                row("r1", "LIVE", Time.valueOf("10:00:00"), Time.valueOf("11:00:00")),
                row("r2", "LIVE", Time.valueOf("10:00:00"), Time.valueOf("11:00:00"))));
        when(scheduleRepository.findOverlappingSchedulesByProviderAccount(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.<Object[]>of(conflictRow("dup-sched")));

        UserScheduleAvailabilityDTO result = service.checkAvailabilityForSession(SESSION_ID, ACCOUNT_ID);

        assertFalse(result.isAvailable());
        assertEquals(1, result.getConflicts().size()); // deduped by meetingKey
    }

    @Test
    void blankInputsAreAvailableWithoutQuerying() {
        UserScheduleAvailabilityDTO result = service.checkAvailabilityForSession(SESSION_ID, "");
        assertTrue(result.isAvailable());
        assertTrue(result.getConflicts().isEmpty());
        verify(scheduleRepository, never())
                .findOverlappingSchedulesByProviderAccount(any(), any(), any(), any(), any(), any());
    }
}
