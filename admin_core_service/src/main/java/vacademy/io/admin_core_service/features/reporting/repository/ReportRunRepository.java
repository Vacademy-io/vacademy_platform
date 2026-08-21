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
     */
    @Query("SELECT r FROM ReportRun r WHERE r.scheduleId = :scheduleId "
            + "AND r.windowStart = :windowStart "
            + "AND (:scopeId IS NULL AND r.scopeId IS NULL OR r.scopeId = :scopeId)")
    Optional<ReportRun> findExisting(@Param("scheduleId") String scheduleId,
                                     @Param("windowStart") Timestamp windowStart,
                                     @Param("scopeId") String scopeId);

    /** Audit view for the institute admin. */
    List<ReportRun> findByInstituteIdOrderByCreatedAtDesc(String instituteId);
}
