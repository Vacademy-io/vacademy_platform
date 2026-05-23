package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.UserLeadProfile;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserLeadProfileRepository extends JpaRepository<UserLeadProfile, String> {

    Optional<UserLeadProfile> findByUserId(String userId);

    Optional<UserLeadProfile> findByUserIdAndInstituteId(String userId, String instituteId);

    List<UserLeadProfile> findByUserIdIn(List<String> userIds);

    Page<UserLeadProfile> findByInstituteId(String instituteId, Pageable pageable);

    /** Find profiles by institute + tier (HOT, WARM, COLD). */
    Page<UserLeadProfile> findByInstituteIdAndLeadTier(String instituteId, String leadTier, Pageable pageable);

    /** Find profiles by institute + conversion status. */
    Page<UserLeadProfile> findByInstituteIdAndConversionStatus(
            String instituteId, String conversionStatus, Pageable pageable);

    /** Count profiles per tier for a given institute. */
    @Query("SELECT p.leadTier, COUNT(p) FROM UserLeadProfile p WHERE p.instituteId = :instituteId GROUP BY p.leadTier")
    List<Object[]> countByTierForInstitute(@Param("instituteId") String instituteId);

    /**
     * Fetch all user IDs for a given institute so the batch rebuild can process them.
     */
    @Query("SELECT p.userId FROM UserLeadProfile p WHERE p.instituteId = :instituteId")
    List<String> findUserIdsByInstituteId(@Param("instituteId") String instituteId);

    /**
     * Bulk move OPEN leads (conversion_status = 'LEAD') currently assigned to
     * {@code fromCounselorId} over to {@code backupId}, scoped to the audiences
     * that belong to the given pool. Used when an admin marks a counselor
     * INACTIVE in a pool and opts to also transfer their existing leads.
     *
     * Scoping rule: a lead is "in this pool" if its user has any
     * audience_response row whose audience belongs to the pool. Pool A going
     * inactive does NOT touch leads tied only to pool B's audiences.
     *
     * Native SQL because the scoping join goes through two non-trivial tables
     * (audience_response, counselor_pool_audience) that aren't worth modeling
     * as JPA associations for this one query.
     */
    @Modifying
    @Query(value = "UPDATE user_lead_profile " +
                   "   SET assigned_counselor_id = :backupId, " +
                   "       assigned_counselor_name = :backupName, " +
                   "       updated_at = NOW() " +
                   " WHERE assigned_counselor_id = :fromCounselorId " +
                   "   AND institute_id = :instituteId " +
                   "   AND conversion_status = 'LEAD' " +
                   "   AND EXISTS (" +
                   "       SELECT 1 FROM audience_response ar " +
                   "         JOIN counselor_pool_audience cpa ON cpa.audience_id = ar.audience_id " +
                   "        WHERE ar.user_id = user_lead_profile.user_id " +
                   "          AND cpa.pool_id = :poolId" +
                   "   )",
           nativeQuery = true)
    int reassignOpenLeadsInPool(@Param("poolId") String poolId,
                                @Param("fromCounselorId") String fromCounselorId,
                                @Param("backupId") String backupId,
                                @Param("backupName") String backupName,
                                @Param("instituteId") String instituteId);
}
