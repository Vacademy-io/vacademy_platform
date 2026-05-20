package vacademy.io.admin_core_service.features.youtube.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadJob;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Repository
public interface YoutubeUploadJobRepository extends JpaRepository<YoutubeUploadJob, String> {

    /**
     * Pick up jobs whose retry deadline has elapsed.
     *
     * Concurrency: this query intentionally has no pessimistic lock. Spring
     * `@Scheduled` methods run without a transaction context by default, and
     * `@Lock(PESSIMISTIC_WRITE)` requires an active tx — combining the two
     * would throw `TransactionRequiredException` on every tick and silently
     * disable the worker. For a single-worker deployment this is moot. If
     * you scale to N workers later, add an `@Version` column on the entity
     * for optimistic locking, or convert `markStarting` into a CAS-style
     * `UPDATE … WHERE status='QUEUED'` to enforce single-processor semantics.
     */
    @Query("SELECT j FROM YoutubeUploadJob j " +
           "WHERE j.status = 'QUEUED' " +
           "AND (j.nextRetryAt IS NULL OR j.nextRetryAt <= :now) " +
           "ORDER BY j.createdAt ASC")
    List<YoutubeUploadJob> findDueJobs(@Param("now") Date now, Pageable pageable);

    List<YoutubeUploadJob> findByInstituteIdOrderByCreatedAtDesc(String instituteId, Pageable pageable);

    List<YoutubeUploadJob> findBySessionScheduleIdOrderByCreatedAtDesc(String sessionScheduleId);

    /** Most recent job for a (schedule, recording) pair — drives the badge state. */
    Optional<YoutubeUploadJob> findFirstBySessionScheduleIdAndRecordingIdOrderByCreatedAtDesc(
            String sessionScheduleId, String recordingId);

    boolean existsByRecordingFileIdAndStatusIn(String recordingFileId, List<String> statuses);
}
