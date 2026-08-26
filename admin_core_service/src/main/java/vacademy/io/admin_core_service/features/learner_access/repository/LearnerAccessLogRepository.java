package vacademy.io.admin_core_service.features.learner_access.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_access.entity.LearnerAccessLog;

import java.util.List;

@Repository
public interface LearnerAccessLogRepository extends JpaRepository<LearnerAccessLog, String> {

    /**
     * Access history for one learner, newest first. {@code packageSessionIds} narrows it to
     * specific batches; pass null to get every batch in the institute.
     */
    @Query("""
            SELECT l FROM LearnerAccessLog l
            WHERE l.instituteId = :instituteId
              AND l.userId = :userId
              AND (:#{#packageSessionIds == null || #packageSessionIds.isEmpty()} = true
                   OR l.packageSessionId IN (:packageSessionIds))
            ORDER BY l.createdAt DESC
            """)
    Page<LearnerAccessLog> findHistory(@Param("instituteId") String instituteId,
                                       @Param("userId") String userId,
                                       @Param("packageSessionIds") List<String> packageSessionIds,
                                       Pageable pageable);

    /** Everything that happened to a batch, newest first — for batch-level reporting. */
    Page<LearnerAccessLog> findByInstituteIdAndPackageSessionIdOrderByCreatedAtDesc(
            String instituteId, String packageSessionId, Pageable pageable);
}
