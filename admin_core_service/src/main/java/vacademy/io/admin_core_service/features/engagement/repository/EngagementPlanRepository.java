package vacademy.io.admin_core_service.features.engagement.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;

import java.util.List;

@Repository
public interface EngagementPlanRepository extends JpaRepository<EngagementPlan, String> {

    @Query("SELECT p FROM EngagementPlan p WHERE p.packageSessionId = :packageSessionId " +
            "AND p.status <> 'DELETED' ORDER BY p.createdAt DESC")
    List<EngagementPlan> findByPackageSession(@Param("packageSessionId") String packageSessionId);

    @Query("SELECT p FROM EngagementPlan p WHERE p.instituteId = :instituteId " +
            "AND p.status <> 'DELETED' ORDER BY p.createdAt DESC")
    List<EngagementPlan> findByInstitute(@Param("instituteId") String instituteId);

    /** Every published plan — the notify tick's starting point. */
    @Query("SELECT p FROM EngagementPlan p WHERE p.status = 'PUBLISHED'")
    List<EngagementPlan> findAllPublished();

    /**
     * Published plans for the batches a learner is enrolled in — the feed entry point.
     *
     * Scoped by institute as well as by batch. Without the institute predicate a plan
     * created under institute A against a batch belonging to institute B was served to
     * B's learners, payload and all — while getItem/submit correctly refused it, so the
     * card could be read but never opened.
     */
    @Query("SELECT p FROM EngagementPlan p WHERE p.packageSessionId IN :packageSessionIds " +
            "AND p.instituteId = :instituteId AND p.status = 'PUBLISHED'")
    List<EngagementPlan> findPublishedForPackageSessions(
            @Param("packageSessionIds") List<String> packageSessionIds,
            @Param("instituteId") String instituteId);
}
