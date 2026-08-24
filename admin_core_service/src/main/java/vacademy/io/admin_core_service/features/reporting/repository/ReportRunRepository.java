package vacademy.io.admin_core_service.features.reporting.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRun;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReportRunRepository extends JpaRepository<ReportRun, String> {

    /**
     * The idempotency lookup. Checked before generating so a retry after a crash
     * resumes rather than repeats; the DB unique index is the actual guarantee,
     * this only avoids doing the work twice.
     *
     * Returns the row whatever its status — the caller decides. A FAILED row must
     * be REUSED rather than skipped or re-inserted: the unique index carries no
     * status column, so inserting again would collide, and skipping would let a
     * transient auth_service or SMTP blip claim the window permanently.
     */
    /**
     * When this schedule last actually reached somebody about this scope.
     *
     * Only SENT counts: a SKIPPED or FAILED run told the reader nothing, so
     * treating it as "you have heard this already" would suppress the very first
     * real report. COALESCE on the scope keeps institute-wide runs (null scope)
     * comparable, matching the idempotency index.
     */
    @Query("SELECT MAX(r.createdAt) FROM ReportRun r WHERE r.scheduleId = :scheduleId "
            + "AND COALESCE(r.scopeId, '') = COALESCE(:scopeId, '') "
            + "AND r.status = 'SENT'")
    java.util.Optional<java.sql.Timestamp> findLastSentAt(@Param("scheduleId") String scheduleId,
                                                          @Param("scopeId") String scopeId);

    @Query("SELECT r FROM ReportRun r WHERE r.scheduleId = :scheduleId "
            + "AND r.windowStart = :windowStart "
            + "AND (:scopeId IS NULL AND r.scopeId IS NULL OR r.scopeId = :scopeId)")
    Optional<ReportRun> findExisting(@Param("scheduleId") String scheduleId,
                                     @Param("windowStart") Timestamp windowStart,
                                     @Param("scopeId") String scopeId);

    /** Audit view for the institute admin. */
    List<ReportRun> findByInstituteIdOrderByCreatedAtDesc(String instituteId);
}
