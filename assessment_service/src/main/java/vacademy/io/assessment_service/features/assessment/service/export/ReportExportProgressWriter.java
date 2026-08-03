package vacademy.io.assessment_service.features.assessment.service.export;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportItem;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportJob;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportItemSource;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportItemStatus;
import vacademy.io.assessment_service.features.assessment.enums.ReportExportJobStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportItemRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentReportExportJobRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.common.core.utils.DateUtil;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * All worker-side writes that must be visible to pollers before the run
 * finishes — hence {@code REQUIRES_NEW} on every method. The worker loop
 * itself ({@code ReportZipExportService.run}) is deliberately NOT
 * {@code @Transactional} (see the comment on that class), so these calls
 * never suspend an outer transaction; if that ever changes, every
 * {@code REQUIRES_NEW} call here would hold a second connection
 * simultaneously and the 5-connection pool deadlocks at two concurrent
 * anything (ARCHITECTURE.md §8.2, self-invocation trap #3).
 */
@Slf4j
@Service
public class ReportExportProgressWriter {

    @Autowired
    private AssessmentReportExportItemRepository itemRepository;

    @Autowired
    private AssessmentReportExportJobRepository jobRepository;

    @Autowired
    private StudentAttemptRepository studentAttemptRepository;

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Invariant I1: an item is DONE ⟹ file_id != null. A DONE item with no
     * file_id would be silently dropped by ZIP assembly, which only reads
     * {@code file_id IS NOT NULL} rows.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordItemResult(String itemId, ReportExportItemStatus status, ReportExportItemSource source,
                                  String fileId, String errorMessage, boolean incrementRetry) {
        if (status == ReportExportItemStatus.DONE && fileId == null) {
            throw new IllegalStateException("Refusing to mark export item " + itemId + " DONE with no file_id");
        }
        AssessmentReportExportItem item = itemRepository.findById(itemId).orElse(null);
        if (item == null) {
            log.warn("[report-export] recordItemResult: item {} not found", itemId);
            return;
        }
        item.setStatus(status.name());
        if (source != null) item.setSource(source.name());
        if (fileId != null) item.setFileId(fileId);
        item.setErrorMessage(errorMessage);
        item.setProcessedAt(DateUtil.getCurrentUtcTime());
        if (incrementRetry) {
            item.setRetryCount((item.getRetryCount() == null ? 0 : item.getRetryCount()) + 1);
        }
        itemRepository.save(item);
    }

    /**
     * Backfills student_attempt.report_pdf_file_id. Separate tx so a failure
     * here never rolls back the item result — the export item is
     * authoritative for the export; the attempt column is an optimisation
     * that lets a future request reuse this PDF without regenerating it.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void backfillAttemptReportFileId(String attemptId, String fileId) {
        try {
            StudentAttempt attempt = studentAttemptRepository.findById(attemptId).orElse(null);
            if (attempt == null) return;
            attempt.setReportPdfFileId(fileId);
            studentAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.warn("[report-export] Failed to backfill report_pdf_file_id for attempt {}: {}", attemptId, e.getMessage());
        }
    }

    /**
     * Single derived UPDATE...FROM, not a read-modify-write — immune to
     * interleaving with the per-item writes above, and structurally
     * guarantees invariant I2 (completed+failed+skipped <= total).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkpoint(String jobId) {
        entityManager.createNativeQuery("""
                UPDATE assessment_report_export_job j SET
                    completed_count = c.done, failed_count = c.failed, skipped_count = c.skipped,
                    updated_at = now()
                FROM (SELECT
                        COUNT(*) FILTER (WHERE status='DONE')    AS done,
                        COUNT(*) FILTER (WHERE status='FAILED')  AS failed,
                        COUNT(*) FILTER (WHERE status='SKIPPED') AS skipped
                      FROM assessment_report_export_item WHERE job_id = :jobId) c
                WHERE j.id = :jobId
                """)
                .setParameter("jobId", jobId)
                .executeUpdate();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finalizeJob(String jobId, ReportExportJobStatus status, String errorMessage) {
        AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;
        job.setStatus(status.name());
        job.setErrorMessage(errorMessage);
        job.setCompletedAt(DateUtil.getCurrentUtcTime());
        job.setUpdatedAt(DateUtil.getCurrentUtcTime());
        jobRepository.save(job);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persistSnapshot(String jobId, String json, int version, boolean drift) {
        AssessmentReportExportJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) return;
        job.setContextSnapshot(json);
        job.setContextSnapshotVersion(version);
        job.setContextDrift(drift);
        job.setUpdatedAt(DateUtil.getCurrentUtcTime());
        jobRepository.save(job);
    }

    /** Cheap projected read — avoids dragging the ~50KB context_snapshot across the wire on every batch boundary. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public boolean isCancelled(String jobId) {
        return jobRepository.findStatusById(jobId)
                .map(s -> ReportExportJobStatus.CANCELLED.name().equals(s))
                .orElse(false);
    }
}
