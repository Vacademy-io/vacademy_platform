package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentReportExportJob;

import java.util.List;
import java.util.Optional;

public interface AssessmentReportExportJobRepository extends JpaRepository<AssessmentReportExportJob, String> {

    Optional<AssessmentReportExportJob>
        findFirstByInstituteIdAndAssessmentIdAndCreatedByUserIdAndStatusInOrderByCreatedAtDesc(
            String instituteId, String assessmentId, String createdByUserId, List<String> statuses);

    Page<AssessmentReportExportJob> findByAssessmentIdAndInstituteIdOrderByCreatedAtDesc(
            String assessmentId, String instituteId, Pageable pageable);

    /**
     * Conditional claim. Rowcount 0 means another thread/pod already won the
     * race (double-click Continue, or the worker racing the endpoint that
     * dispatched it — see ARCHITECTURE.md §10 scenario (b), step 8).
     */
    // @Transactional is REQUIRED here: both callers (the worker's run() and the
    // continue endpoint) are deliberately non-transactional, and a @Modifying
    // query without an active transaction throws TransactionRequiredException
    // at runtime. This also guarantees the claim is committed before either
    // caller proceeds to dispatch.
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE assessment_report_export_job
           SET status = 'IN_PROGRESS', updated_at = now(),
               started_at = COALESCE(started_at, now())
         WHERE id = :jobId AND status IN (:fromStatuses)
        """, nativeQuery = true)
    int claimForRun(@Param("jobId") String jobId, @Param("fromStatuses") List<String> fromStatuses);

    /**
     * Cheap projected read for the batch-boundary cancel check — avoids
     * dragging the ~50KB context_snapshot across the wire on every poll.
     */
    @Query("SELECT j.status FROM AssessmentReportExportJob j WHERE j.id = :jobId")
    Optional<String> findStatusById(@Param("jobId") String jobId);
}
