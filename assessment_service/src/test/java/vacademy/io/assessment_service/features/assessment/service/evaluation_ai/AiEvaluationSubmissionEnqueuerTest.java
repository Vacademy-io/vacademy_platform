package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Whether a submission queues an AI evaluation.
 *
 * This class decides when institute credits get spent without anyone clicking anything,
 * so the tests that matter most are the ones asserting it does NOTHING: an assessment
 * that never opted in, and a resubmit that would pay twice for one attempt.
 */
class AiEvaluationSubmissionEnqueuerTest {

        private AiEvaluationProcessRepository repository;
        private AiEvaluationSubmissionEnqueuer enqueuer;

        @BeforeEach
        void setUp() {
                repository = mock(AiEvaluationProcessRepository.class);
                enqueuer = new AiEvaluationSubmissionEnqueuer(repository);
                ReflectionTestUtils.setField(enqueuer, "onSubmitEnabled", true);
                when(repository.findActiveByAttemptId(anyString(), anyList())).thenReturn(List.of());
                when(repository.save(any(AiEvaluationProcess.class))).thenAnswer(invocation -> {
                        AiEvaluationProcess p = invocation.getArgument(0);
                        p.setId("process-1");
                        return p;
                });
        }

        private StudentAttempt attempt(String id) {
                StudentAttempt attempt = new StudentAttempt();
                attempt.setId(id);
                return attempt;
        }

        private Assessment assessment(Boolean aiEnabled) {
                Assessment assessment = new Assessment();
                assessment.setId("assessment-1");
                assessment.setAiEvaluationEnabled(aiEnabled);
                return assessment;
        }

        @Test
        void queuesWhenTheAssessmentOptedIn() {
                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(true));

                assertThat(processId).isEqualTo("process-1");
                verify(repository).save(any(AiEvaluationProcess.class));
        }

        @Test
        void queuedJobStartsPendingSoThePollerOwnsDispatch() {
                enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(true));

                org.mockito.ArgumentCaptor<AiEvaluationProcess> captor =
                                org.mockito.ArgumentCaptor.forClass(AiEvaluationProcess.class);
                verify(repository).save(captor.capture());

                AiEvaluationProcess queued = captor.getValue();
                assertThat(queued.getStatus()).isEqualTo(AiEvaluationStatusEnum.PENDING.name());
                // startedAt stays null until a worker actually begins, which is what
                // separates "queued" from "running" for the stale-job sweeper.
                assertThat(queued.getStartedAt()).isNull();
        }

        @Test
        void doesNothingWhenTheAssessmentNeverOptedIn() {
                // NULL is how every assessment created before V43 reads. None of them may
                // start spending credits because a column was added underneath them.
                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(null));

                assertThat(processId).isNull();
                verify(repository, never()).save(any(AiEvaluationProcess.class));
        }

        @Test
        void doesNothingWhenExplicitlyDisabled() {
                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(false));

                assertThat(processId).isNull();
                verify(repository, never()).save(any(AiEvaluationProcess.class));
        }

        @Test
        void doesNotQueueTwiceForTheSameAttempt() {
                // The learner client retries submit up to 3 times with backoff, and submit is
                // not idempotent -- without this guard a flaky network pays for one attempt
                // several times over.
                AiEvaluationProcess inFlight = new AiEvaluationProcess();
                inFlight.setId("existing-process");
                when(repository.findActiveByAttemptId(anyString(), anyList())).thenReturn(List.of(inFlight));

                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(true));

                assertThat(processId).isEqualTo("existing-process");
                verify(repository, never()).save(any(AiEvaluationProcess.class));
        }

        @Test
        void killSwitchStopsAllAutomaticEvaluation() {
                ReflectionTestUtils.setField(enqueuer, "onSubmitEnabled", false);

                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(true));

                assertThat(processId).isNull();
                verify(repository, never()).save(any(AiEvaluationProcess.class));
        }

        @Test
        void aRepositoryFailureNeverBreaksTheSubmission() {
                // This runs at the tail of a learner's submit. Losing an exam to protect an
                // optional grading step would be the wrong trade every time.
                when(repository.findActiveByAttemptId(anyString(), anyList()))
                                .thenThrow(new RuntimeException("database is down"));

                String processId = enqueuer.enqueueIfEnabled(attempt("attempt-1"), assessment(true));

                assertThat(processId).isNull();
        }

        @Test
        void nullInputsAreIgnoredRatherThanThrowing() {
                assertThat(enqueuer.enqueueIfEnabled(null, assessment(true))).isNull();
                assertThat(enqueuer.enqueueIfEnabled(attempt("attempt-1"), null)).isNull();
                verify(repository, never()).save(any(AiEvaluationProcess.class));
        }
}
