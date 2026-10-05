package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;

import java.sql.Timestamp;
import java.util.List;

@Repository
public interface LeadFollowupRepository extends JpaRepository<LeadFollowup, String> {

    List<LeadFollowup> findByAudienceResponseIdOrderByScheduleTimeAsc(String audienceResponseId);

    List<LeadFollowup> findByCreatedByAndIsClosedFalseOrderByScheduleTimeAsc(String createdBy);

    List<LeadFollowup> findByInstituteIdAndIsClosedFalseOrderByScheduleTimeAsc(String instituteId);

    /** Manager view: pending follow-ups owned by anyone in the caller's hierarchy scope. */
    List<LeadFollowup> findByInstituteIdAndCreatedByInAndIsClosedFalseOrderByScheduleTimeAsc(
            String instituteId, List<String> createdBy);

    /*
     * Completed follow-ups. Paged, unlike their pending counterparts above: the
     * closed set only ever grows, so an institute a year in would otherwise be
     * handing the browser every follow-up it has ever finished.
     *
     * Scoped on created_by to match the pending queries exactly. Who CLOSED a
     * follow-up is a different question from whose follow-up it is, and only
     * the latter decides who may see it; closed_by rides along on the DTO for
     * display.
     */
    Page<LeadFollowup> findByInstituteIdAndIsClosedTrue(String instituteId, Pageable pageable);

    Page<LeadFollowup> findByInstituteIdAndCreatedByInAndIsClosedTrue(
            String instituteId, List<String> createdBy, Pageable pageable);

    Page<LeadFollowup> findByCreatedByAndIsClosedTrue(String createdBy, Pageable pageable);

    /**
     * Batch fetch of every OPEN scheduled follow-up for the given leads, oldest schedule_time first.
     * Used by the leads-list to populate the "Follow up at" column with the counsellor-scheduled
     * callback time (preferred over the SLA-derived fallback). Caller groups by audience_response_id
     * and keeps the earliest row.
     */
    @Query("SELECT lf FROM LeadFollowup lf " +
           "WHERE lf.audienceResponseId IN :ids " +
           "  AND lf.isClosed = false " +
           "  AND lf.scheduleTime IS NOT NULL " +
           "ORDER BY lf.scheduleTime ASC")
    List<LeadFollowup> findOpenByAudienceResponseIds(@Param("ids") List<String> ids);

    // ─── Scheduler scans (LeadAutomationScheduler.scanScheduledFollowups) ───

    /** PENDING follow-ups whose scheduled time has arrived (or is just past). */
    @Query("SELECT lf FROM LeadFollowup lf " +
           "WHERE lf.status = 'PENDING' AND lf.isClosed = false AND lf.scheduleTime <= :now")
    List<LeadFollowup> findDueCandidates(@Param("now") Timestamp now);

    /** ONGOING (already-due) follow-ups that have crossed the overdue threshold. */
    @Query("SELECT lf FROM LeadFollowup lf " +
           "WHERE lf.status = 'ONGOING' AND lf.isClosed = false AND lf.scheduleTime <= :overdueAt")
    List<LeadFollowup> findOverdueCandidates(@Param("overdueAt") Timestamp overdueAt);

    /**
     * Atomic PENDING → ONGOING transition. Returns 1 only for the replica that wins the
     * race, so FOLLOW_UP_DUE fires exactly once per follow-up row across replicas.
     */
    @Modifying
    @Transactional
    @Query("UPDATE LeadFollowup lf SET lf.status = 'ONGOING' " +
           "WHERE lf.id = :id AND lf.status = 'PENDING' AND lf.isClosed = false")
    int claimDueTransition(@Param("id") String id);

    /**
     * Atomic ONGOING → OVERDUE transition. Returns 1 only for the winning replica.
     */
    @Modifying
    @Transactional
    @Query("UPDATE LeadFollowup lf SET lf.status = 'OVERDUE' " +
           "WHERE lf.id = :id AND lf.status = 'ONGOING' AND lf.isClosed = false")
    int claimOverdueTransition(@Param("id") String id);

    /**
     * Undo a claim whose emission then failed, so the next scan retries it.
     *
     * <p>The claim has to happen BEFORE the emit (it is what makes the one-fire guarantee
     * hold across replicas), which means a failed emit would otherwise leave the row
     * advanced with nothing sent — and since the status only ever moves forward, that
     * follow-up's reminder would be lost permanently rather than retried. One transient
     * auth-service or workflow blip silently costs a counsellor their reminder.</p>
     *
     * <p>Retrying is safe: the workflow emission is idempotent per follow-up id
     * (eventId = the row id under EVENT_BASED dedup), so a re-run cannot double-fire the
     * workflow. Only the baseline bell alert can repeat, which is the right trade against
     * dropping it entirely.</p>
     *
     * <p>Guarded on the expected current status so a release can never drag a row
     * backwards past a transition another replica legitimately made in the meantime.</p>
     */
    @Modifying
    @Transactional
    @Query("UPDATE LeadFollowup lf SET lf.status = 'PENDING' " +
           "WHERE lf.id = :id AND lf.status = 'ONGOING' AND lf.isClosed = false")
    int releaseDueTransition(@Param("id") String id);

    /** Overdue twin of {@link #releaseDueTransition}. */
    @Modifying
    @Transactional
    @Query("UPDATE LeadFollowup lf SET lf.status = 'ONGOING' " +
           "WHERE lf.id = :id AND lf.status = 'OVERDUE' AND lf.isClosed = false")
    int releaseOverdueTransition(@Param("id") String id);
}
