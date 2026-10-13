package vacademy.io.admin_core_service.features.telephony.publicapi;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallResultRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.admin_core_service.features.telephony.publicapi.entity.AiCallApiCall;
import vacademy.io.admin_core_service.features.telephony.publicapi.repository.AiCallApiCallRepository;
import vacademy.io.admin_core_service.features.telephony.queue.entity.AiCallQueueItem;
import vacademy.io.admin_core_service.features.telephony.queue.repository.AiCallQueueItemRepository;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AiCallingApiViewsTest {

    private AiCallQueueItemRepository queue;
    private TelephonyCallLogRepository logs;
    private AiCallResultRepository results;
    private AiCallingApiViews views;

    @BeforeEach
    void setUp() {
        queue = mock(AiCallQueueItemRepository.class);
        logs = mock(TelephonyCallLogRepository.class);
        results = mock(AiCallResultRepository.class);
        views = new AiCallingApiViews(mock(AiCallApiCallRepository.class), queue, logs, results, mock(MediaService.class));
        when(results.findByCallLogIdIn(any())).thenReturn(List.of());
    }

    private static AiCallApiCall call(String queueId, String logId) {
        return AiCallApiCall.builder().id("call_1").instituteId("inst-1").agentId("a").phoneNumber("+919876543210")
                .queueItemId(queueId).callLogId(logId).createdAt(Instant.now()).build();
    }

    private void queueItem(String status, Instant notBefore, String reason) {
        AiCallQueueItem q = AiCallQueueItem.builder().id("q1").status(status).notBefore(notBefore)
                .statusReason(reason).build();
        when(queue.findById("q1")).thenReturn(Optional.of(q));
    }

    private void callLog(String status, Instant updated) {
        TelephonyCallLog l = TelephonyCallLog.builder().id("l1").status(status)
                .updatedAt(Timestamp.from(updated)).build();
        when(logs.findById("l1")).thenReturn(Optional.of(l));
    }

    @Test
    void aWaitingCallOutsideHoursShowsWhenItWillGo() {
        Instant later = Instant.now().plus(Duration.ofHours(10));
        queueItem("QUEUED", later, "Outside calling hours.");
        AiCallingApiViews.State s = views.state(call("q1", null));
        assertEquals("queued", s.status());
        assertFalse(s.isFinal());
        assertEquals(later, s.scheduledFor());
        assertEquals("Outside calling hours.", s.reason());
    }

    @Test
    void queueOutcomesBeforeAnyDial() {
        queueItem("DISPATCHING", null, null);
        assertEquals("dialing", views.state(call("q1", null)).status());
        queueItem("CANCELLED", null, "Already called the maximum number of times today.");
        AiCallingApiViews.State c = views.state(call("q1", null));
        assertEquals("canceled", c.status());
        assertTrue(c.isFinal());
        queueItem("EXPIRED", null, null);
        assertEquals("expired", views.state(call("q1", null)).status());
        queueItem("FAILED", null, "Could not be placed after 3 attempts.");
        assertEquals("failed", views.state(call("q1", null)).status());
    }

    @Test
    void unansweredCallsAreFinalAtOnce() {
        callLog("NO_ANSWER", Instant.now());
        AiCallingApiViews.State s = views.state(call(null, "l1"));
        assertEquals("no_answer", s.status());
        assertTrue(s.isFinal());
        callLog("BUSY", Instant.now());
        assertEquals("busy", views.state(call(null, "l1")).status());
    }

    @Test
    void aConnectedCallWaitsForItsOutcome() {
        callLog("COMPLETED", Instant.now());
        AiCallingApiViews.State waiting = views.state(call(null, "l1"));
        assertEquals("completed", waiting.status());
        assertFalse(waiting.isFinal());

        AiCallResult r = AiCallResult.builder().id("r1").callLogId("l1").processingStatus("PROCESSED")
                .disposition("Interested").transcript("assistant: Hello\nuser: Hi").build();
        when(results.findByCallLogIdIn(any())).thenReturn(List.of(r));
        AiCallingApiViews.State done = views.state(call(null, "l1"));
        assertTrue(done.isFinal());
        Map<String, Object> view = views.call(call(null, "l1"), done, false);
        @SuppressWarnings("unchecked")
        Map<String, Object> outcome = (Map<String, Object>) view.get("outcome");
        assertEquals("Interested", outcome.get("disposition"));
    }

    @Test
    void aConnectedCallWithoutAnOutcomeIsFinalisedAfterTheWait() {
        callLog("COMPLETED", Instant.now().minus(Duration.ofMinutes(11)));
        AiCallingApiViews.State s = views.state(call(null, "l1"));
        assertTrue(s.isFinal());
        assertNull(views.call(call(null, "l1"), s, false).get("outcome"));
    }

    @Test
    void transcriptLinesBecomeTurns() {
        List<Map<String, String>> t = AiCallingApiViews.transcript(
                "assistant: Namaste, main Riya\nuser: Haan boliye\nkaun?\nassistant: Tutezy se\n\nuser:   ");
        assertEquals(3, t.size());
        assertEquals(Map.of("speaker", "agent", "text", "Namaste, main Riya"), t.get(0));
        assertEquals(Map.of("speaker", "contact", "text", "Haan boliye kaun?"), t.get(1));
        assertEquals("agent", t.get(2).get("speaker"));
        assertTrue(AiCallingApiViews.transcript(null).isEmpty());
    }

    @Test
    void meetingComesFromTheReportPayload() {
        Map<String, Object> m = AiCallingApiViews.meeting(
                "{\"meetingRequested\":true,\"meetingDatetimeIso\":\"2026-10-14T18:00:00+05:30\","
                        + "\"meetingDatetimeText\":\"tomorrow 6 pm\",\"meetingType\":\"demo\"}");
        assertEquals(true, m.get("requested"));
        assertEquals("2026-10-14T18:00:00+05:30", m.get("at"));
        assertEquals("tomorrow 6 pm", m.get("time_text"));
        assertEquals("demo", m.get("type"));

        Map<String, Object> none = AiCallingApiViews.meeting("{\"mock\":true}");
        assertEquals(false, none.get("requested"));
        assertNull(none.get("at"));
        assertEquals(false, AiCallingApiViews.meeting("not json").get("requested"));
        assertEquals(false, AiCallingApiViews.meeting(null).get("requested"));
    }
}
