package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The queue drainer. In prod its first hours were a loop of "claimed 3, 6,
 * 9, 12..." with nothing dispatched: one lazy proxy threw before the try in
 * dispatch() and killed every tick. A row must never take the tick down, and
 * rows claimed by a failed tick must be handed out under the same cap.
 */
class AiEvaluationQueuePollerTest {

    private AiEvaluationProcessRepository repository;
    private AiEvaluationAsyncService worker;
    private AiEvaluationQueuePoller poller;

    @BeforeEach
    void setUp() {
        repository = mock(AiEvaluationProcessRepository.class);
        worker = mock(AiEvaluationAsyncService.class);
        poller = new AiEvaluationQueuePoller(repository, worker);
        ReflectionTestUtils.setField(poller, "pollerEnabled", true);
        ReflectionTestUtils.setField(poller, "batchSize", 3);
        ReflectionTestUtils.setField(poller, "maxInFlight", 3);
        ReflectionTestUtils.setField(poller, "claimStaleMinutes", 15L);
        when(repository.countByStatusIn(anyList())).thenReturn(0L);
        when(repository.claimPendingJobs(anyString(), any(), any(), anyInt())).thenReturn(3);
    }

    private static AiEvaluationProcess process(String id, String model) {
        AiEvaluationProcess p = new AiEvaluationProcess();
        p.setId(id);
        StudentAttempt attempt = new StudentAttempt();
        attempt.setId("attempt-" + id);
        p.setStudentAttempt(attempt);
        Assessment a = new Assessment();
        a.setAiEvaluationModel(model);
        p.setAssessment(a);
        return p;
    }

    @Test
    void dispatchesAtMostRoomRowsEvenWhenEarlierClaimsPiledUp() {
        when(repository.findClaimedPending(anyString())).thenReturn(List.of(
                process("p1", "m"), process("p2", "m"), process("p3", "m"), process("p4", "m"), process("p5", "m")));

        poller.drainQueue();

        verify(worker, times(3)).evaluateAttemptAsync(anyString(), anyString(), eq("m"));
        verify(worker, never()).evaluateAttemptAsync(eq("p4"), anyString(), any());
    }

    @Test
    void aRowWhoseAssessmentCannotBeReadDoesNotStopTheOthers() {
        AiEvaluationProcess broken = spy(process("broken", "m"));
        when(broken.getAssessment()).thenThrow(new IllegalStateException("could not initialize proxy - no Session"));
        when(repository.findClaimedPending(anyString())).thenReturn(List.of(broken, process("ok", "m")));

        poller.drainQueue();

        verify(worker).evaluateAttemptAsync(eq("ok"), eq("attempt-ok"), eq("m"));
        verify(worker, never()).evaluateAttemptAsync(eq("broken"), anyString(), any());
    }

    @Test
    void nothingIsClaimedWhenTheCapIsFull() {
        when(repository.countByStatusIn(anyList())).thenReturn(3L);

        poller.drainQueue();

        verify(repository, never()).claimPendingJobs(anyString(), any(), any(), anyInt());
        verify(worker, never()).evaluateAttemptAsync(anyString(), anyString(), any());
    }

    @Test
    void aDisabledPollerDoesNothing() {
        ReflectionTestUtils.setField(poller, "pollerEnabled", false);
        poller.drainQueue();
        verify(repository, never()).countByStatusIn(anyList());
    }
}
