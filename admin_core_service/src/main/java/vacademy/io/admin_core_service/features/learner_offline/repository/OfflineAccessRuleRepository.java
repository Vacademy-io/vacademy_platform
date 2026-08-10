package vacademy.io.admin_core_service.features.learner_offline.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineAccessRule;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType;

import java.util.List;
import java.util.Optional;

@Repository
public interface OfflineAccessRuleRepository extends JpaRepository<OfflineAccessRule, String> {

    Optional<OfflineAccessRule> findBySourceTypeAndSourceIdAndPackageSessionId(
            OfflineSourceType sourceType, String sourceId, String packageSessionId);

    Optional<OfflineAccessRule> findBySourceTypeAndSourceIdAndPackageSessionIdIsNull(
            OfflineSourceType sourceType, String sourceId);

    /**
     * Every rule relevant to a batch: rules scoped to this package session
     * (PACKAGE_SESSION/SUBJECT/MODULE/CHAPTER/SLIDE), plus the course-wide
     * PACKAGE rule for the package that owns it. Feeds both the admin
     * "GET /rules" listing and the manifest builder's resolver pass.
     */
    @Query("""
            SELECT r FROM OfflineAccessRule r
            WHERE r.packageSessionId = :packageSessionId
               OR (r.sourceType = vacademy.io.admin_core_service.features.learner_offline.enums.OfflineSourceType.PACKAGE
                   AND r.sourceId = :packageId
                   AND r.packageSessionId IS NULL)
            """)
    List<OfflineAccessRule> findAllForPackageSession(
            @Param("packageSessionId") String packageSessionId,
            @Param("packageId") String packageId);

    void deleteBySourceTypeAndSourceIdAndPackageSessionId(
            OfflineSourceType sourceType, String sourceId, String packageSessionId);

    void deleteBySourceTypeAndSourceIdAndPackageSessionIdIsNull(
            OfflineSourceType sourceType, String sourceId);
}
