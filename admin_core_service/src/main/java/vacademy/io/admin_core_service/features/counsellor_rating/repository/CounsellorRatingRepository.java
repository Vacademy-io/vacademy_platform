package vacademy.io.admin_core_service.features.counsellor_rating.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.counsellor_rating.entity.CounsellorRating;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CounsellorRatingRepository extends JpaRepository<CounsellorRating, String> {

    /** Single counsellor's cached rating. Powers the single-rating endpoint + per-row hydration in the workbench list. */
    Optional<CounsellorRating> findByInstituteIdAndCounsellorUserId(String instituteId, String counsellorUserId);

    /** All cached ratings for an institute. Used by the leaderboard's top-N query (caller does the ORDER BY). */
    List<CounsellorRating> findByInstituteId(String instituteId);

    /**
     * Batched read for the workbench's visible page. One query for N
     * counsellors instead of N round-trips. Empty input returns an empty
     * list — caller handles the trivial case.
     */
    List<CounsellorRating> findByInstituteIdAndCounsellorUserIdIn(String instituteId,
                                                                   Collection<String> counsellorUserIds);
}
