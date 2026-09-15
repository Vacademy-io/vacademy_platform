package vacademy.io.assessment_service.features.assessment.copy_intake.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.copy_intake.entity.AiCopyIntakeBatch;
import vacademy.io.assessment_service.features.assessment.copy_intake.entity.AiCopyIntakeItem;
import vacademy.io.assessment_service.features.assessment.copy_intake.repository.AiCopyIntakeBatchRepository;
import vacademy.io.assessment_service.features.assessment.copy_intake.service.StudentNameMatcher.Candidate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Works through a batch's copies off the request thread: read the name, place
 * the copy, queue it. The AI check itself is then drained by the evaluation
 * poller under its in-flight cap.
 *
 * <p>Also a safety net: every couple of minutes any batch still RUNNING is
 * picked up again - unread copies (a pod restarted mid-batch) get read, and a
 * batch whose last callback was missed gets settled. Running twice is safe:
 * each copy is claimed with an atomic status change, so overlapping runs
 * (two pods, or a sweep landing during the first pass) share the work instead
 * of repeating it.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class CopyIntakeRunner {

    private final CopyIntakeService service;
    private final AiCopyIntakeBatchRepository batchRepository;

    /** Header reads in parallel per batch. Each is a ~5 s vision call. */
    @Value("${assessment.copy-intake.identify-parallelism:2}")
    private int identifyParallelism;

    @Async
    public void run(String batchId) {
        process(batchId);
    }

    void process(String batchId) {
        AiCopyIntakeBatch batch = batchRepository.findById(batchId).orElse(null);
        if (batch == null || !AiCopyIntakeBatch.RUNNING.equals(batch.getStatus())) return;

        service.recoverStaleIdentifying(batchId);
        List<AiCopyIntakeItem> pending = service.pendingItems(batchId);
        if (!pending.isEmpty()) {
            // The student list is loaded once per pass, not once per copy: the
            // batch learners come from admin-core over HTTP. If that is down the
            // copies stay PENDING and the sweep tries again in a couple of minutes.
            List<Candidate> candidates;
            try {
                candidates = service.candidatesFor(batch.getAssessmentId(), batch.getInstituteId());
            } catch (Exception e) {
                log.error("[copy-intake] batch {}: student list unavailable: {}", batchId, e.getMessage());
                service.noteBatchError(batchId, "Could not load the student list (" + e.getMessage()
                        + "); the copies will be read again shortly.");
                return;
            }
            if (batch.getErrorMessage() != null) service.noteBatchError(batchId, null);
            log.info("[copy-intake] batch {}: reading {} copies against {} students",
                    batchId, pending.size(), candidates.size());
            readAll(pending, candidates);
        }
        service.syncQueuedItems(batchId);
        service.finalizeIfDone(batchId);
    }

    /**
     * Small parallelism: the reader is one vision call per copy, and a
     * 200-copy batch read serially would take 15+ minutes before the first
     * copy even queued. Each copy is claimed inside identifyAndPlace, so a
     * copy another pass already took is skipped here at no cost.
     */
    private void readAll(List<AiCopyIntakeItem> pending, List<Candidate> candidates) {
        ExecutorService pool = Executors.newFixedThreadPool(Math.max(1, identifyParallelism));
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (AiCopyIntakeItem item : pending) {
                futures.add(pool.submit(() -> {
                    try {
                        service.identifyAndPlace(item.getId(), candidates);
                    } catch (Exception e) {
                        log.error("[copy-intake] item {} failed: {}", item.getId(), e.getMessage(), e);
                    }
                }));
            }
            for (Future<?> f : futures) {
                try {
                    f.get();
                } catch (Exception ignored) {
                    // logged inside the task
                }
            }
        } finally {
            pool.shutdown();
        }
    }

    /** Resume interrupted batches and settle finished ones nothing reported. */
    @Scheduled(fixedDelayString = "${assessment.copy-intake.sweep-interval-ms:120000}",
            initialDelayString = "${assessment.copy-intake.sweep-initial-delay-ms:60000}")
    public void sweep() {
        try {
            for (AiCopyIntakeBatch batch : batchRepository.findByStatus(AiCopyIntakeBatch.RUNNING)) {
                try {
                    process(batch.getId());
                } catch (Exception e) {
                    log.warn("[copy-intake] sweep of batch {} failed: {}", batch.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("[copy-intake] sweep failed: {}", e.getMessage());
        }
    }
}
