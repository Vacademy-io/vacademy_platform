package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;

import java.net.InetAddress;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.UUID;

/**
 * Drains the AI-evaluation queue.
 *
 * Submissions only ENQUEUE (see {@link AiEvaluationSubmissionEnqueuer}); this is what
 * actually starts the work. Splitting the two is the point of the design: the job is
 * owned by a row in the database, not by whichever pod served the learner's submit, so a
 * deploy or a crash mid-exam does not lose anybody's grading.
 *
 * Every replica runs this loop, which is safe because claiming is a single atomic UPDATE
 * (see AiEvaluationProcessRepository#claimPendingJobs). Without that, two pods would
 * routinely grade the same attempt -- and since AI evaluation is metered per graded
 * question, that means charging the institute twice for one submission.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiEvaluationQueuePoller {

        private final AiEvaluationProcessRepository processRepository;
        private final AiEvaluationAsyncService aiEvaluationAsyncService;

        /**
         * Off by default.
         *
         * The queue can fill (assessments opt in) without anything draining it, which
         * means this can be rolled out and watched before it starts spending credits.
         * Turn it on once the queued rows look right.
         */
        @Value("${assessment.ai-evaluation.poller-enabled:false}")
        private boolean pollerEnabled;

        /**
         * How many jobs one instance takes per tick. Small on purpose: each job is a
         * multi-minute OCR + LLM pipeline on a shared async pool, so a big batch would
         * just queue up inside the JVM where the sweeper cannot see it, and starve the
         * teacher-triggered path that shares that pool.
         */
        @Value("${assessment.ai-evaluation.poller-batch-size:5}")
        private int batchSize;

        /**
         * A claim older than this is treated as abandoned and may be taken by another
         * instance. Must stay comfortably longer than the time between claiming and the
         * worker moving the row off PENDING, or two pods will pick up the same job.
         */
        @Value("${assessment.ai-evaluation.claim-stale-minutes:15}")
        private long claimStaleMinutes;

        /**
         * Cap on copies with the AI service at once, across all instances. One
         * ai-service pod and one render-worker serve everyone; without this a
         * 200-copy bulk upload was dispatched in ten minutes, every job then
         * fought for the same CPU, and the ones that lost were swept as stale
         * before they had started. Queued rows stay PENDING and wait their turn.
         */
        @Value("${assessment.ai-evaluation.max-in-flight:3}")
        private int maxInFlight;

        /** Statuses that mean "with the AI service now" - counted against the cap. */
        static final List<String> IN_FLIGHT = List.of(
                        "PROCESSING", "DISPATCHED", "STARTED", "EXTRACTING", "EVALUATING", "GRADING", "IN_PROGRESS");

        /**
         * Identifies this instance in claimed_by. Host name plus a per-boot suffix: the
         * host alone is not enough, because a restarted pod keeps its name and would
         * otherwise look like the owner of claims made by the process it replaced.
         */
        private final String instanceId = buildInstanceId();

        private static String buildInstanceId() {
                String host;
                try {
                        host = InetAddress.getLocalHost().getHostName();
                } catch (Exception e) {
                        host = "unknown-host";
                }
                String suffix = UUID.randomUUID().toString().substring(0, 8);
                String id = host + "-" + suffix;
                // claimed_by is varchar(120).
                return id.length() > 120 ? id.substring(0, 120) : id;
        }

        @Scheduled(fixedDelayString = "${assessment.ai-evaluation.poller-interval-ms:15000}",
                        initialDelayString = "${assessment.ai-evaluation.poller-initial-delay-ms:30000}")
        public void drainQueue() {
                if (!pollerEnabled) {
                        return;
                }
                try {
                        List<AiEvaluationProcess> claimed = claimBatch();
                        if (claimed.isEmpty()) {
                                return;
                        }

                        log.info("[ai-eval-poller] {} claimed {} queued evaluation(s)", instanceId, claimed.size());
                        for (AiEvaluationProcess process : claimed) {
                                dispatch(process);
                        }
                } catch (Exception e) {
                        // A scheduled method that throws is not retried, and on some
                        // schedulers it silently stops being scheduled at all. Swallow, log,
                        // and let the next tick try again.
                        log.error("[ai-eval-poller] tick failed: {}", e.getMessage(), e);
                }
        }

        /**
         * Claim, then read back what we got.
         *
         * Two statements rather than one because the claim has to be a bare UPDATE for
         * the atomicity to hold; reading the claimed rows afterwards is safe precisely
         * because claimed_by is now ours and no other instance will take them.
         *
         * The transaction lives on the repository method, NOT here. This is called from
         * a @Scheduled method on the same bean, and Spring's proxy does not intercept
         * self-invocation -- an @Transactional annotation on this method would look
         * correct and do nothing, which is exactly how the marks calculation in
         * StudentAttemptService ended up running outside a transaction.
         */
        private List<AiEvaluationProcess> claimBatch() {
                Date now = new Date();
                Date staleBefore = Date.from(Instant.now().minus(claimStaleMinutes, ChronoUnit.MINUTES));

                long inFlight = processRepository.countByStatusIn(IN_FLIGHT);
                int room = (int) Math.max(0, Math.min(batchSize, maxInFlight - inFlight));
                if (room == 0) {
                        return List.of();
                }
                int claimedCount = processRepository.claimPendingJobs(instanceId, now, staleBefore, room);
                if (claimedCount == 0) {
                        return List.of();
                }
                // Rows a previous tick claimed but could not dispatch (a failed tick)
                // come back here too; still hand out at most `room` at a time so the
                // in-flight cap holds. The rest stay ours for the next tick.
                List<AiEvaluationProcess> claimed = processRepository.findClaimedPending(instanceId);
                return claimed.size() > room ? claimed.subList(0, room) : claimed;
        }

        /**
         * Hand one job to the existing worker.
         *
         * The worker is the same one the teacher-triggered path uses, so automatic and
         * manual evaluations behave identically from here on -- same progress reporting,
         * same callbacks, same review-and-release gates before a learner sees anything.
         */
        private void dispatch(AiEvaluationProcess process) {
                String processId = process.getId();
                String attemptId = process.getStudentAttempt() == null ? null : process.getStudentAttempt().getId();
                if (attemptId == null) {
                        log.error("[ai-eval-poller] process {} has no attempt, leaving it for the sweeper", processId);
                        return;
                }

                try {
                        // Inside the try: the assessment is fetched with the claim query, but
                        // a lazy proxy here once threw "no Session" before the try and took
                        // the whole tick down with it - every tick, for every row.
                        String model = process.getAssessment() == null ? null
                                        : process.getAssessment().getAiEvaluationModel();
                        aiEvaluationAsyncService.evaluateAttemptAsync(processId, attemptId, model);
                        log.info("[ai-eval-poller] dispatched evaluation {} for attempt {} (model {})",
                                        processId, attemptId, model);
                } catch (Exception e) {
                        // The row stays PENDING with our claim on it. Once the claim goes stale
                        // another instance re-claims it, so a dispatch failure costs a delay
                        // rather than the job.
                        log.error("[ai-eval-poller] could not dispatch evaluation {}: {}", processId, e.getMessage(), e);
                }
        }
}
