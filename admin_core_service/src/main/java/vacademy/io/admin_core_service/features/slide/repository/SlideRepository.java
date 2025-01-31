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
        COALESCE(SUM(CASE WHEN s.sourceType = 'VIDEO' THEN 1 ELSE 0 END), 0) AS videoCount,
        COALESCE(SUM(CASE WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'PDF') THEN 1 ELSE 0 END), 0) AS pdfCount,
        COALESCE(SUM(CASE WHEN s.sourceType = 'DOCUMENT' AND EXISTS (SELECT 1 FROM DocumentSlide d WHERE d.id = s.sourceId AND d.type = 'DOC') THEN 1 ELSE 0 END), 0) AS docCount,
        COALESCE(SUM(CASE WHEN s.sourceType NOT IN ('VIDEO', 'DOCUMENT') THEN 1 ELSE 0 END), 0) AS unknownCount
    )
    FROM ChapterToSlides cts
    JOIN Slide s ON cts.slide.id = s.id
    WHERE cts.chapter.id = :chapterId
    AND cts.status != 'DELETED'
    AND s.status != 'DELETED'
""")
    SlideCountProjection countSlidesByChapterId(@Param("chapterId") String chapterId);
}
