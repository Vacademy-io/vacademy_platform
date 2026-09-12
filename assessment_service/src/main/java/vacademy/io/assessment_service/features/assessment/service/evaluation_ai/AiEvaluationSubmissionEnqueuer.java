package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;

import java.util.List;

/**
 * Queues an AI evaluation when a learner submits, for assessments that opted in.
 *
 * Deliberately separate from {@link AiEvaluationService#triggerEvaluation}, which is the
 * teacher pressing "Evaluate with AI" on the submissions table. That path is interactive:
 * it validates institute access, reports per-attempt failures back to the caller, and
 * dispatches immediately. This one runs inside a learner's submit request, where none of
 * that applies -- there is no admin to report to, and nothing here may ever make a
 * submission fail.
 *
 * It only ENQUEUES. {@link AiEvaluationQueuePoller} does the dispatching, so the work is
 * owned by a row in the database rather than by whichever pod happened to serve the
 * submit -- if that pod dies a moment later, another one picks the job up.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiEvaluationSubmissionEnqueuer {

        /**
         * An evaluation in any of these states already covers this attempt. Mirrors
         * AiEvaluationService.ACTIVE_STATUSES -- re-declared rather than shared because
         * the two paths are independent and should be free to diverge.
         */
        private static final List<String> ACTIVE_STATUSES = List.of(
                        AiEvaluationStatusEnum.PENDING.name(),
                        AiEvaluationStatusEnum.STARTED.name(),
                        AiEvaluationStatusEnum.PROCESSING.name(),
                        AiEvaluationStatusEnum.EXTRACTING.name(),
                        AiEvaluationStatusEnum.EVALUATING.name());

        private final AiEvaluationProcessRepository aiEvaluationProcessRepository;

        /**
         * Kill switch. Turning this off stops all automatic evaluation without touching
         * per-assessment settings, which is what you want at 2am if the AI service is
         * misbehaving or credits are being burned unexpectedly. The teacher-triggered
         * path is unaffected.
         */
        @Value("${assessment.ai-evaluation.on-submit-enabled:true}")
        private boolean onSubmitEnabled;

        /**
         * Queue an evaluation for a just-submitted attempt.
         *
         * REQUIRES_NEW: this runs at the tail of the learner's submit. It must not join
         * that transaction, because a failure here would then roll back the submission
         * itself -- losing a learner's exam to protect an optional grading nicety is the
         * wrong trade every time. For the same reason every exit path is a log, never a
         * throw.
         *
         * @return the process id, or null when nothing was queued
         */
        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public String enqueueIfEnabled(StudentAttempt attempt, Assessment assessment) {
                try {
                        if (!onSubmitEnabled) {
                                return null;
                        }
                        if (attempt == null || assessment == null) {
                                return null;
                        }
                        // NULL means off. Every assessment that existed before V43 reads as
                        // NULL here, so none of them start spending credits on their own.
                        if (!Boolean.TRUE.equals(assessment.getAiEvaluationEnabled())) {
                                return null;
                        }

                        // The learner client retries submit up to 3 times with backoff, and the
                        // submit endpoint itself is not idempotent -- so without this check a
                        // flaky network would queue (and pay for) the same attempt repeatedly.
                        List<AiEvaluationProcess> active = aiEvaluationProcessRepository
                                        .findActiveByAttemptId(attempt.getId(), ACTIVE_STATUSES);
                        if (!active.isEmpty()) {
                                log.info("[AI-EVAL-ENQUEUE] Attempt {} already has evaluation {} in flight, skipping",
                                                attempt.getId(), active.get(0).getId());
                                return active.get(0).getId();
                        }

                        AiEvaluationProcess process = new AiEvaluationProcess();
                        process.setStudentAttempt(attempt);
                        process.setAssessment(assessment);
                        process.setStatus(AiEvaluationStatusEnum.PENDING.name());
                        // startedAt is stamped by the worker when it actually begins. Leaving it
                        // null here is what distinguishes "queued" from "running" for the
                        // stale-job sweeper.
                        AiEvaluationProcess saved = aiEvaluationProcessRepository.save(process);

                        log.info("[AI-EVAL-ENQUEUE] Queued evaluation {} for attempt {} (assessment {}, model {})",
                                        saved.getId(), attempt.getId(), assessment.getId(),
                                        assessment.getAiEvaluationModel());
                        return saved.getId();
                } catch (Exception e) {
                        // A submission that succeeded must still read as a success to the learner.
                        log.error("[AI-EVAL-ENQUEUE] Could not queue evaluation for attempt {}: {}",
                                        attempt == null ? "?" : attempt.getId(), e.getMessage(), e);
                        return null;
                }
        }
}
