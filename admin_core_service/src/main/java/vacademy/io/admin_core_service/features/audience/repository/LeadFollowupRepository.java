package vacademy.io.admin_core_service.features.audience.repository;

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
}
