package vacademy.io.assessment_service.features.assessment.service.export;

import com.itextpdf.layout.font.FontProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.export.RenderPacket;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportItem;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportJob;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportItemSource;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportItemStatus;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportJobStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportItemRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportJobRepository;
import vacademy.io.assessment_service.features.assessment.service.ReportPdfRenderService;
import vacademy.io.assessment_service.features.assessment.service.ReportPdfUploadService;
import vacademy.io.assessment_service.features.assessment.service.render.ReportFontProviderHolder;
import vacademy.io.assessment_service.features.assessment.service.render.ReportRenderResources;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;
import vacademy.io.assessment_service.features.learner_assessment.service.LearnerReportService;
import vacademy.io.assessment_service.features.notification.service.NotificationService;

import java.util.List;

/**
 * The bulk report export worker. Owns the batch loop and the status machine.
 *
 * <p><b>MUST NOT be {@code @Transactional}</b> — see ARCHITECTURE.md §8.2,
 * self-invocation trap #3. This method holds no transaction of its own; every
 * write goes through {@link ReportExportProgressWriter}'s {@code REQUIRES_NEW}
 * methods, and every read from {@link ReportBatchProcessor}'s own short
 * transaction. If this method is ever annotated {@code @Transactional}, every
 * {@code REQUIRES_NEW} call inside the loop would hold a second connection
 * simultaneously and the 5-connection Hikari pool deadlocks at two
 * concurrent anything.
 *
 * <p>{@code alreadyClaimed} exists because of a real race
 * (ARCHITECTURE.md §10 scenario (b), step 8): on Continue, the endpoint
 * claims the job with a conditional UPDATE before dispatching; if the worker
 * re-claimed here, it would always lose that race against itself. The
 * initiate path passes {@code false} (nothing has claimed it yet); the
 * continue path passes {@code true}.
 */
@Slf4j
@Service
public class ReportZipExportService {

    @Autowired
    private AssessmentReportExportJobRepository jobRepository;

    @Autowired
    private AssessmentReportExportItemRepository itemRepository;

    @Autowired
    private LearnerReportService learnerReportService;

    @Autowired
    private ReportBatchProcessor batchProcessor;

    @Autowired
    private ReportPdfRenderService renderService;

    @Autowired
    private ReportPdfUploadService uploadService;

    @Autowired
    private ReportExportProgressWriter progressWriter;

    @Autowired
    private ReportZipAssemblyService zipAssemblyService;

    @Autowired
    private ReportExportContextSerializer contextSerializer;

    @Autowired
    private ReportExportProperties properties;

    @Autowired
    private ReportFontProviderHolder fontProviderHolder;

    @Autowired
    private NotificationService notificationService;

    @Async("reportExportExecutor")
    public void run(String jobId, boolean alreadyClaimed) {
        try {
            if (!alreadyClaimed) {
                int claimed = jobRepository.claimForRun(jobId,
                        List.of(ReportExportJobStatus.PENDING.name(), ReportExportJobStatus.PARTIAL.name(),
                                ReportExportJobStatus.FAILED.name(), ReportExportJobStatus.CANCELLED.name()));
                if (claimed == 0) {
                    log.info("[report-export] job {} already claimed by another run — skipping", jobId);
                    return;
                }
            }

            AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
            if (job == null) {
                log.warn("[report-export] job {} vanished before the worker could read it", jobId);
                return;
            }

            ReportClassContext ctx = resolveContext(job);
            ReportRenderResources resources = ReportRenderResources.forJob(ctx, fontProviderHolder.get());

            List<AssessmentReportExportItem> items = itemRepository.findProcessable(jobId, properties.getMaxRetry());
            runPhaseA(job, ctx, resources, items);

            // Nothing DONE means nothing to assemble — finalize with the REAL
            // aggregated cause instead of letting assemble() throw its generic
            // "Nothing to assemble" (which told the admin nothing when all
            // items failed on, e.g., an unreachable media service).
            List<AssessmentReportExportItem> allItems = itemRepository.findByJobIdOrderByCreatedAt(jobId);
            boolean anyDone = allItems.stream()
                    .anyMatch(i -> ReportExportItemStatus.DONE.name().equals(i.getStatus()) && i.getFileId() != null);
            if (!anyDone) {
                String reason = aggregateFailureReason(allItems);
                log.warn("[report-export] job {} produced no reports — finalizing FAILED: {}", jobId, reason);
                progressWriter.finalizeJob(jobId, ReportExportJobStatus.FAILED, truncate(reason));
                notifyJobCreator(jobId, ReportExportJobStatus.FAILED, ctx.getAssessmentName());
                return;
            }

            var assembled = zipAssemblyService.assemble(jobId);

            // A cancel that arrived during Phase A must survive: finalizeJob
            // writes status unconditionally, so without this guard a cancelled
            // job would be stomped back to PARTIAL/COMPLETED here. The ZIP was
            // still assembled above so the admin can download what finished —
            // plan §4.2: a cancelled job with DONE items behaves like PARTIAL
            // for download purposes, but keeps its CANCELLED status.
            if (progressWriter.isCancelled(jobId)) {
                log.info("[report-export] job {} cancelled — leaving status CANCELLED ({} included in ZIP)",
                        jobId, assembled.getIncludedCount());
                return;
            }

            long remaining = itemRepository.findProcessable(jobId, properties.getMaxRetry()).size();
            ReportExportJobStatus finalStatus = remaining == 0
                    ? ReportExportJobStatus.COMPLETED
                    : ReportExportJobStatus.PARTIAL;
            progressWriter.finalizeJob(jobId, finalStatus, null);
            log.info("[report-export] job {} finished with status {} ({} included in ZIP)",
                    jobId, finalStatus, assembled.getIncludedCount());
            notifyJobCreator(jobId, finalStatus, ctx.getAssessmentName());
        } catch (Exception e) {
            log.error("[report-export] job {} failed: {}", jobId, e.getMessage(), e);
            try {
                progressWriter.finalizeJob(jobId, ReportExportJobStatus.FAILED, truncate(e.getMessage()));
                notifyJobCreator(jobId, ReportExportJobStatus.FAILED, null);
            } catch (Exception inner) {
                log.error("[report-export] failed to even record failure for job {}: {}", jobId, inner.getMessage());
            }
        }
    }

    /**
     * In-app SYSTEM_ALERT to the admin who started the export, fired on every
     * terminal outcome the worker reaches (COMPLETED / PARTIAL / FAILED). The
     * job can take minutes and the dialog is closable, so this is how an admin
     * who navigated away learns the ZIP is ready. No alert on CANCELLED — the
     * admin did that themselves. Best-effort: a notification failure must
     * never mark an otherwise-successful export as anything but done.
     */
    private void notifyJobCreator(String jobId, ReportExportJobStatus outcome, String assessmentName) {
        try {
            AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
            if (job == null || job.getCreatedByUserId() == null) return;

            String name = assessmentName != null ? assessmentName : "your assessment";
            int done = job.getCompletedCount() == null ? 0 : job.getCompletedCount();
            int total = job.getTotalCount() == null ? 0 : job.getTotalCount();

            String title;
            String body;
            switch (outcome) {
                case COMPLETED -> {
                    title = "Report export ready";
                    body = "All " + done + " student reports for \"" + name
                            + "\" are ready. Open the Submissions tab to download the ZIP.";
                }
                case PARTIAL -> {
                    title = "Report export partially completed";
                    body = done + " of " + total + " student reports for \"" + name
                            + "\" are ready. You can download the completed reports or continue the export from the Submissions tab.";
                }
                default -> {
                    title = "Report export failed";
                    body = "Your student report export" + (assessmentName != null ? " for \"" + name + "\"" : "")
                            + " could not be completed. You can retry it from the Submissions tab.";
                }
            }
            notificationService.sendSystemAlertToUsers(job.getInstituteId(), List.of(job.getCreatedByUserId()), title, body);
        } catch (Exception e) {
            log.warn("[report-export] failed to notify creator of job {}: {}", jobId, e.getMessage());
        }
    }

    private void runPhaseA(AssessmentReportExportJob job, ReportClassContext ctx, ReportRenderResources resources,
                            List<AssessmentReportExportItem> items) {
        int batchSize = Math.max(1, properties.getBatchSize());
        for (int i = 0; i < items.size(); i += batchSize) {
            if (progressWriter.isCancelled(job.getId())) {
                log.info("[report-export] job {} cancelled at batch boundary ({} of {} processed)",
                        job.getId(), i, items.size());
                break;
            }
            List<AssessmentReportExportItem> batch = items.subList(i, Math.min(i + batchSize, items.size()));
            for (AssessmentReportExportItem item : batch) {
                processItem(job, ctx, resources, item);
            }
            progressWriter.checkpoint(job.getId());
            sleepQuietly(properties.getBatchPauseMs());
        }
    }

    private void processItem(AssessmentReportExportJob job, ReportClassContext ctx, ReportRenderResources resources,
                              AssessmentReportExportItem item) {
        try {
            RenderPacket packet = batchProcessor.loadRenderPacket(item.getAttemptId(), ctx);
            if (packet.getSkipReason() != null) {
                progressWriter.recordItemResult(item.getId(), ReportExportItemStatus.SKIPPED, null, null,
                        packet.getSkipReason(), false);
                return;
            }

            if (packet.getExistingReportPdfFileId() != null && !Boolean.TRUE.equals(job.getRegenerate())) {
                progressWriter.recordItemResult(item.getId(), ReportExportItemStatus.DONE, ReportExportItemSource.REUSED,
                        packet.getExistingReportPdfFileId(), null, false);
                return;
            }

            byte[] bytes = renderService.render(packet.getDetail(), packet.getComparison(), ctx, resources);
            String fileName = "report_" + item.getAttemptId() + ".pdf";
            // Throws on failure (ReportPdfUploadService contract) — caught below
            // so the item ends up FAILED, not silently DONE-with-no-file_id.
            String fileId = uploadService.upload(bytes, fileName, "ASSESSMENT_REPORT_EXPORT", job.getAssessmentId());

            progressWriter.recordItemResult(item.getId(), ReportExportItemStatus.DONE, ReportExportItemSource.GENERATED,
                    fileId, null, false);
            progressWriter.backfillAttemptReportFileId(item.getAttemptId(), fileId);
        } catch (Exception e) {
            log.warn("[report-export] item {} (attempt {}) failed: {}", item.getId(), item.getAttemptId(), e.getMessage());
            progressWriter.recordItemResult(item.getId(), ReportExportItemStatus.FAILED, null, null,
                    truncate(e.getClass().getSimpleName() + ": " + e.getMessage()), true);
        }
    }

    /**
     * Restores the snapshot on resume (byte-identical class stats across every
     * report in the bundle — the §6.3 guarantee), or builds fresh on the first
     * run. Deserialisation failure rebuilds fresh and flags drift rather than
     * failing the job (D5) — see ARCHITECTURE.md §9.
     */
    private ReportClassContext resolveContext(AssessmentReportExportJob job) {
        if (job.getContextSnapshot() != null) {
            var restored = contextSerializer.fromJson(job.getContextSnapshot(), job.getContextSnapshotVersion());
            if (restored.isPresent()) {
                ReportClassContext ctx = restored.get();
                hydrateNonSnapshotted(ctx);
                return ctx;
            }
            log.warn("[report-export] context snapshot unreadable for job {} (version {}) — rebuilding fresh; "
                    + "class statistics in this run may differ from earlier runs in the same job", job.getId(), job.getContextSnapshotVersion());
        }
        ReportClassContext ctx = learnerReportService.loadClassContext(job.getAssessmentId(), job.getInstituteId());
        progressWriter.persistSnapshot(job.getId(), contextSerializer.toJson(ctx), ReportExportContextSerializer.CURRENT_VERSION,
                job.getContextSnapshot() != null);
        return ctx;
    }

    /**
     * Re-derives the @JsonIgnore'd fields (sections, question order, option
     * distribution) via the lightweight structural query — 3 queries, not the
     * full 7-query + 2-HTTP-call loadClassContext (ARCHITECTURE.md §9: "the
     * only DB work the context needs on restore").
     */
    private void hydrateNonSnapshotted(ReportClassContext ctx) {
        LearnerReportService.StructuralData structural =
                learnerReportService.loadStructuralData(ctx.getAssessmentId(), ctx.getInstituteId());
        ctx.setSections(structural.sections());
        ctx.setQuestionOrderByQuestionAndSection(structural.questionOrderByQuestionAndSection());
        ctx.setOptionDistribution(structural.optionDistribution());
    }

    /**
     * "All 3 reports failed. Most common error (3x): Failed to obtain
     * presigned upload URL..." — the top-line reason an admin actually needs,
     * derived from the per-item errors.
     */
    private String aggregateFailureReason(List<AssessmentReportExportItem> items) {
        long failed = items.stream()
                .filter(i -> ReportExportItemStatus.FAILED.name().equals(i.getStatus())).count();
        long skipped = items.stream()
                .filter(i -> ReportExportItemStatus.SKIPPED.name().equals(i.getStatus())).count();

        String mostCommon = items.stream()
                .filter(i -> ReportExportItemStatus.FAILED.name().equals(i.getStatus())
                        && i.getErrorMessage() != null)
                .collect(java.util.stream.Collectors.groupingBy(
                        AssessmentReportExportItem::getErrorMessage, java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .max(java.util.Map.Entry.comparingByValue())
                .map(e -> " Most common error (" + e.getValue() + "x): " + e.getKey())
                .orElse("");

        if (failed == 0 && skipped > 0) {
            return "No reports could be generated: all " + skipped
                    + " selected submissions were skipped (not evaluated).";
        }
        return "All " + failed + " report(s) failed; " + skipped + " skipped." + mostCommon;
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String truncate(String s) {
        if (s == null) return null;
        return s.length() > 2000 ? s.substring(0, 2000) : s;
    }
}
