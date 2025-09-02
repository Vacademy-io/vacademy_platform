package vacademy.io.admin_core_service.features.common.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.common.dto.RatingSummaryProjection;
import vacademy.io.admin_core_service.features.common.entity.Rating;

import java.util.List;


@Repository
public interface RatingRepository extends JpaRepository<Rating, String> {

    List<Rating> findBySourceIdAndSourceTypeAndStatusIn(String sourceId, String sourceType, List<String>statusList);
    
    @Query(
        value = "SELECT DISTINCT r.* FROM rating r " +
            "LEFT JOIN package_session ps ON ps.id = r.source_id " +
            "AND (:packageSessionStatuses IS NULL OR ps.status IN (:packageSessionStatuses)) " +
            "WHERE ( " +
            "    ((:ratingStatuses IS NULL OR r.status IN (:ratingStatuses)) " +
            "     AND (:sourceTypes IS NULL OR r.source_type IN (:sourceTypes)) " +
            "     AND (:packageSessionStatuses IS NULL OR ps.id IS NOT NULL) " +
            "     AND ps.package_id = :sourceId " +
            "    ) " +
            "  OR " +
            "    (r.source_id = :sourceId AND (:ratingStatuses IS NULL OR r.status IN (:ratingStatuses))) " +
            ")",
        countQuery = "SELECT COUNT(DISTINCT r.id) FROM rating r " +
            "LEFT JOIN package_session ps ON ps.p.id = r.source_id " +
            "AND (:packageSessionStatuses IS NULL OR ps.status IN (:packageSessionStatuses)) " +
            "WHERE ( " +
            "    ((:ratingStatuses IS NULL OR r.status IN (:ratingStatuses)) " +
            "     AND (:sourceTypes IS NULL OR r.source_type IN (:sourceTypes)) " +
            "     AND (:packageSessionStatuses IS NULL OR ps.id IS NOT NULL) " +
            "     AND ps.package_id = :sourceId " +
            "    ) " +
            "  OR " +
            "    (r.source_id = :sourceId AND (:ratingStatuses IS NULL OR r.status IN (:ratingStatuses))) " +
            ")",
        nativeQuery = true
    )
    Page<Rating> getAllRatingsWithFilter(
        @Param("ratingStatuses") List<String> ratingStatuses,
        @Param("packageSessionStatuses") List<String> packageSessionStatuses,
        @Param("sourceTypes") List<String> sourceTypes,
        @Param("sourceId") String sourceId,
        Pageable pageable
    );




    @Query(value = """
    SELECT * FROM rating
    WHERE source_type = :sourceType
      AND source_id = :sourceId
      AND status IN (:ratingStatuses)
    ORDER BY created_at DESC
    """,
        countQuery = """
    SELECT COUNT(*) FROM rating
    WHERE source_type = :sourceType
      AND source_id = :sourceId
      AND status IN (:ratingStatuses)
    """,
        nativeQuery = true)
    Page<Rating> findRatingsBySourceAndStatus(
        @Param("sourceType") String sourceType,
        @Param("sourceId") String sourceId,
        @Param("ratingStatuses") List<String> ratingStatuses,
        Pageable pageable
    );

    @Query(value = """
    SELECT
      FLOOR(AVG(points) + 0.5) AS averageRating,
      COUNT(*) AS totalReviews,
      ROUND(
        CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(points + 0.5) = 5) / NULLIF(COUNT(*), 0)) AS numeric), 2
      ) AS percentFiveStar,
      ROUND(
        CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(points + 0.5) = 4) / NULLIF(COUNT(*), 0)) AS numeric), 2
      ) AS percentFourStar,
      ROUND(
        CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(points + 0.5) = 3) / NULLIF(COUNT(*), 0)) AS numeric), 2
      ) AS percentThreeStar,
      ROUND(
        CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(points + 0.5) = 2) / NULLIF(COUNT(*), 0)) AS numeric), 2
      ) AS percentTwoStar,
      ROUND(
        CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(points + 0.5) = 1) / NULLIF(COUNT(*), 0)) AS numeric), 2
      ) AS percentOneStar
    FROM rating
    WHERE source_id = :sourceId
      AND source_type = :sourceType
      AND (
        :#{#ratingStatuses == null || #ratingStatuses.isEmpty()} = true
        OR status IN (:ratingStatuses)
      )
    """,
            nativeQuery = true)
    RatingSummaryProjection getRatingSummary(
            @Param("sourceId") String sourceId,
            @Param("sourceType") String sourceType,
            @Param("ratingStatuses") List<String> ratingStatuses
    );


    @Query(value = """
    SELECT
      FLOOR(AVG(r.points) + 0.5) AS averageRating,
      COUNT(*) AS totalReviews,
      ROUND(CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(r.points + 0.5) = 5)) / NULLIF(COUNT(*), 0) AS numeric), 2) AS percentFiveStar,
      ROUND(CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(r.points + 0.5) = 4)) / NULLIF(COUNT(*), 0) AS numeric), 2) AS percentFourStar,
      ROUND(CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(r.points + 0.5) = 3)) / NULLIF(COUNT(*), 0) AS numeric), 2) AS percentThreeStar,
      ROUND(CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(r.points + 0.5) = 2)) / NULLIF(COUNT(*), 0) AS numeric), 2) AS percentTwoStar,
      ROUND(CAST((100.0 * COUNT(*) FILTER (WHERE FLOOR(r.points + 0.5) = 1)) / NULLIF(COUNT(*), 0) AS numeric), 2) AS percentOneStar
    FROM rating r
    LEFT JOIN package_session ps ON ps.id = r.source_id
      AND (:packageSessionStatuses IS NULL OR ps.status IN (:packageSessionStatuses))
    WHERE (
      (
        (:ratingStatuses IS NULL OR r.status IN (:ratingStatuses)) AND
        (:sourceTypes IS NULL OR r.source_type IN (:sourceTypes)) AND
        (:packageSessionStatuses IS NULL OR ps.id IS NOT NULL) AND
        ps.package_id = :sourceId
      )
      OR
      (
        r.source_id = :sourceId AND (:ratingStatuses IS NULL OR r.status IN (:ratingStatuses))
      )
    )
    """,
        nativeQuery = true)
    RatingSummaryProjection getFilteredRatingSummary(
        @Param("ratingStatuses") List<String> ratingStatuses,
        @Param("packageSessionStatuses") List<String> packageSessionStatuses,
        @Param("sourceTypes") List<String> sourceTypes,
        @Param("sourceId") String sourceId
    );

    Page<Rating> findBySourceTypeAndSourceIdAndStatusNotIn(String sourceType, String sourceId, List<String> excludedStatuses, Pageable pageable);

}
