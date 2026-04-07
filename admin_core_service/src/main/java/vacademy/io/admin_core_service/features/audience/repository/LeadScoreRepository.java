package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.LeadScore;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeadScoreRepository extends JpaRepository<LeadScore, String> {

    Optional<LeadScore> findByAudienceResponseId(String audienceResponseId);

    List<LeadScore> findByAudienceResponseIdIn(List<String> audienceResponseIds);

    List<LeadScore> findByAudienceIdOrderByRawScoreDesc(String audienceId);

    /**
     * Batch recalculate percentile ranks for all leads in a campaign.
     * Uses PERCENT_RANK window function partitioned by audience_id.
     */
    @Modifying
    @Query(value = """
        UPDATE lead_score ls SET percentile_rank = sub.pct, updated_at = NOW()
        FROM (
            SELECT id,
                   PERCENT_RANK() OVER (PARTITION BY audience_id ORDER BY raw_score) * 100 as pct
            FROM lead_score
            WHERE audience_id = :audienceId
        ) sub
        WHERE ls.id = sub.id
        AND ls.audience_id = :audienceId
        """, nativeQuery = true)
    void recalculatePercentilesForAudience(@Param("audienceId") String audienceId);

    /**
     * Batch recalculate percentile ranks for ALL leads in an institute (across all campaigns).
     */
    @Modifying
    @Query(value = """
        UPDATE lead_score ls SET percentile_rank = sub.pct, updated_at = NOW()
        FROM (
            SELECT id,
                   PERCENT_RANK() OVER (PARTITION BY audience_id ORDER BY raw_score) * 100 as pct
            FROM lead_score
            WHERE institute_id = :instituteId
        ) sub
        WHERE ls.id = sub.id
        AND ls.institute_id = :instituteId
        """, nativeQuery = true)
    void recalculatePercentilesForInstitute(@Param("instituteId") String instituteId);

    /**
     * Get all distinct audience IDs that have lead scores (for batch job).
     */
    @Query("SELECT DISTINCT ls.audienceId FROM LeadScore ls")
    List<String> findDistinctAudienceIds();
}
