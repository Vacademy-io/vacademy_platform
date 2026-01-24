package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.slide.entity.HtmlVideoSlide;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface HtmlVideoSlideRepository extends JpaRepository<HtmlVideoSlide, String> {
    @Query(value = """
            SELECT
                COALESCE(
                    (
                        SELECT hv.video_length
                        FROM slide s
                        JOIN html_video_slide hv ON s.source_id = hv.id
                        WHERE s.id = :slideId
                        ORDER BY hv.created_at DESC
                        LIMIT 1
                    ),
                    1
                ) AS video_length
            """, nativeQuery = true)
    Long getVideoLength(@Param("slideId") String slideId);
}
