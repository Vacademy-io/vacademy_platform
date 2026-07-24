package vacademy.io.admin_core_service.features.learner_badge.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.learner_badge.entity.LearnerBadge;
import vacademy.io.admin_core_service.features.learner_badge.entity.LearnerBadgeStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface LearnerBadgeRepository extends JpaRepository<LearnerBadge, String> {

    @Query("SELECT lb FROM LearnerBadge lb WHERE lb.userId = :userId AND lb.instituteId = :instituteId AND lb.status = :status ORDER BY lb.awardedAt DESC")
    List<LearnerBadge> findByUserIdAndInstituteIdAndStatus(@Param("userId") String userId,
                                                           @Param("instituteId") String instituteId,
                                                           @Param("status") LearnerBadgeStatus status);

    @Query("SELECT lb FROM LearnerBadge lb WHERE lb.userId = :userId AND lb.badgeId = :badgeId AND lb.instituteId = :instituteId AND lb.status = 'ACTIVE'")
    Optional<LearnerBadge> findActiveAward(@Param("userId") String userId,
                                           @Param("badgeId") String badgeId,
                                           @Param("instituteId") String instituteId);

    /**
     * Any row (ACTIVE or REVOKED) for this user+badge — used by the auto-unlock sync to
     * skip badges already awarded, already synced, or explicitly revoked by an admin.
     */
    boolean existsByUserIdAndBadgeIdAndInstituteId(String userId, String badgeId, String instituteId);

    /** Count of active awarded badges per user, for the given users (leaderboard badge column). */
    @Query("SELECT lb.userId, COUNT(lb) FROM LearnerBadge lb WHERE lb.instituteId = :instituteId AND lb.userId IN :userIds AND lb.status = 'ACTIVE' GROUP BY lb.userId")
    List<Object[]> countActiveBadgesByUsers(@Param("instituteId") String instituteId,
                                            @Param("userIds") List<String> userIds);

    /** Active awarded badges (rows: userId, badgeName, badgeIcon) per user, most recent first. */
    @Query("SELECT lb.userId, lb.badgeName, lb.badgeIcon FROM LearnerBadge lb WHERE lb.instituteId = :instituteId AND lb.userId IN :userIds AND lb.status = 'ACTIVE' ORDER BY lb.awardedAt DESC")
    List<Object[]> findActiveBadgesByUsers(@Param("instituteId") String instituteId,
                                           @Param("userIds") List<String> userIds);

    /** Per-badge award counts for the institute (admin badges-overview stats). */
    @Query("SELECT lb.badgeId, lb.badgeName, lb.badgeIcon, COUNT(lb) FROM LearnerBadge lb WHERE lb.instituteId = :instituteId AND lb.status = 'ACTIVE' GROUP BY lb.badgeId, lb.badgeName, lb.badgeIcon ORDER BY COUNT(lb) DESC")
    List<Object[]> getBadgeStats(@Param("instituteId") String instituteId);

    /** Number of distinct learners holding at least one active badge in the institute. */
    @Query("SELECT COUNT(DISTINCT lb.userId) FROM LearnerBadge lb WHERE lb.instituteId = :instituteId AND lb.status = 'ACTIVE'")
    long countDistinctLearnersWithActiveBadge(@Param("instituteId") String instituteId);
}
