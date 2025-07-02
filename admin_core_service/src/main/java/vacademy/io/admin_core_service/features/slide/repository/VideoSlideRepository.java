package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.slide.entity.VideoSlide;

public interface VideoSlideRepository extends JpaRepository<VideoSlide, String> {
    @Query(value = """
    SELECT 
        COALESCE(
            (
                SELECT v.published_video_length 
                FROM slide s
                JOIN video v ON s.source_id = v.id
                WHERE s.id = :slideId
                ORDER BY v.created_at DESC
                LIMIT 1
            ), 
            1
        ) AS published_video_length
    """, nativeQuery = true)
    Long getPublishedVideoLength(@Param("slideId") String slideId);
}
