package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
