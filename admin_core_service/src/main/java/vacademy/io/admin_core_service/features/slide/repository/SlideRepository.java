package vacademy.io.admin_core_service.features.slide.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailProjection;
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

    @Query(value = "SELECT DISTINCT ON (s.id) s.id AS slideId, s.title AS slideTitle, s.description AS slideDescription, " +
            "s.source_type AS sourceType, s.status AS status, s.image_file_id AS imageFileId, " +
            "ds.id AS documentId, ds.title AS documentTitle, ds.cover_file_id AS documentCoverFileId, " +
            "ds.type AS documentType, ds.data AS documentData, " +
            "vs.id AS videoId, vs.title AS videoTitle, vs.url AS videoUrl, vs.description AS videoDescription, " +
            "cts.slide_order AS slideOrder " +
            "FROM chapter_to_slides cts " +
            "JOIN slide s ON cts.slide_id = s.id " +
            "JOIN chapter ch ON cts.chapter_id = ch.id " +
            "LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT' " +
            "LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO' " +
            "WHERE ch.id = :chapterId " +
            "AND s.status IN :status " +
            "ORDER BY s.id, cts.slide_order IS NULL, cts.slide_order ASC",
            nativeQuery = true)
    List<SlideDetailProjection> findSlideDetailsByChapterId(@Param("chapterId") String chapterId, @Param("status") List<String> status);

    @Query(value = "SELECT DISTINCT ON (s.id) s.id AS slideId, s.title AS slideTitle, s.description AS slideDescription, " +
            "s.source_type AS sourceType, s.status AS status, s.image_file_id AS imageFileId, " +
            "ds.id AS documentId, ds.title AS documentTitle, ds.cover_file_id AS documentCoverFileId, " +
            "ds.type AS documentType, ds.data AS documentData, " +
            "vs.id AS videoId, vs.title AS videoTitle, vs.url AS videoUrl, vs.description AS videoDescription, " +
            "cts.slide_order AS slideOrder " +
            "FROM slide s " +
            "JOIN activity_log al ON al.slide_id = s.id " +
            "JOIN chapter_to_slides cts ON s.id = cts.slide_id " +
            "JOIN chapter ch ON cts.chapter_id = ch.id " +
            "LEFT JOIN document_slide ds ON ds.id = s.source_id AND s.source_type = 'DOCUMENT' " +
            "LEFT JOIN video vs ON vs.id = s.source_id AND s.source_type = 'VIDEO' " +
            "WHERE al.user_id = :userId " +
            "AND s.status IN :status " +
            "AND (al.percentage_watched IS NULL OR al.percentage_watched != 100) " +
            "ORDER BY s.id, al.updated_at DESC " +
            "LIMIT 5",
            nativeQuery = true)
    List<SlideDetailProjection> findRecentIncompleteSlidesByUserId(
            @Param("userId") String userId,
            @Param("status") List<String> status);

}
