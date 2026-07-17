package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;

/**
 * Marks AI-evaluation runs that have been stuck in a non-terminal state past a
 * timeout as FAILED. Without this, an ai_service crash / deploy mid-grade (no
 * terminal callback ever arrives) leaves a process PROCESSING forever: the
 * progress page hangs, the dashboard shows it running, and — because of the
 * trigger-idempotency guard — the teacher can't even re-trigger it.
 *
 * <p>Staleness is measured from {@code started_at}: a single-attempt copy grades
 * in minutes (OCR ~5 min + per-question grading), so a non-terminal process
 * older than the (generous, configurable) timeout is certainly dead. Marking it
 * FAILED surfaces it as a retryable row on the evaluations dashboard.
 *
 * <p>The sweep only transitions rows to FAILED (no counters, re-dispatch, or LLM
 * calls), so it is idempotent and safe to run on every replica.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationStaleJobSweeper {

    private final AiEvaluationProcessRepository processRepository;

    /** States that mean "still running" and are eligible to be swept if too old. */
    private static final List<String> NON_TERMINAL = List.of(
            "PENDING", "PROCESSING", "DISPATCHED", "STARTED",
            "EXTRACTING", "EVALUATING", "GRADING", "IN_PROGRESS");

    @Value("${assessment.ai-evaluation.stale-timeout-minutes:30}")
    private long staleTimeoutMinutes;

    @Scheduled(fixedDelayString = "${assessment.ai-evaluation.sweeper-interval-ms:300000}",
            initialDelayString = "${assessment.ai-evaluation.sweeper-initial-delay-ms:120000}")
    @Transactional
    public void sweepStaleProcesses() {
        Date cutoff = Date.from(Instant.now().minus(staleTimeoutMinutes, ChronoUnit.MINUTES));
        List<AiEvaluationProcess> stale = processRepository.findStaleNonTerminal(NON_TERMINAL, cutoff);
        if (stale.isEmpty()) {
            return;
        }
        log.warn("[ai-eval-sweeper] marking {} stale AI-evaluation process(es) FAILED (no activity for > {} min)",
                stale.size(), staleTimeoutMinutes);
        Date now = new Date();
        for (AiEvaluationProcess process : stale) {
            process.setStatus("FAILED");
            process.setCurrentStep("TIMED_OUT");
            process.setErrorMessage(
                    "Evaluation timed out — no response from the AI service. Please retry.");
            process.setCompletedAt(now);
        }
        processRepository.saveAll(stale);
    }
}
