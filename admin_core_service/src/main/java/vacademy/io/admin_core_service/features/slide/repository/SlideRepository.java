package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection;
import vacademy.io.admin_core_service.features.slide.entity.Slide;

import java.util.List;

public interface SlideRepository extends JpaRepository<Slide, String> {
    @Query("""
    SELECT new vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection(
        CASE 
            WHEN s.sourceType = 'VIDEO' THEN 'VIDEO' 
            WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'PDF') THEN 'PDF'
            WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'DOC') THEN 'DOC'
            ELSE 'UNKNOWN'
        END AS sourceCategory,
        COUNT(s.id) AS slideCount
    )
    FROM ChapterToSlides cts
    JOIN Slide s ON cts.slide.id = s.id
    WHERE cts.chapter.id = :chapterId
    AND cts.status != 'DELETED'
    AND s.status != 'DELETED'
    GROUP BY 
        s.sourceType,
        s.sourceId
""")
    List<SlideCountProjection> countSlidesByChapterId(@Param("chapterId") String chapterId);
}
