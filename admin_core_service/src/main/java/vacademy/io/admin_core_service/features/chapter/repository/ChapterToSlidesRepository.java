package vacademy.io.admin_core_service.features.chapter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;

import java.util.List;
import java.util.Optional;

public interface ChapterToSlidesRepository extends JpaRepository<ChapterToSlides, String> {

        @Query(value = "SELECT * FROM chapter_to_slides cts " +
                        "WHERE cts.chapter_id = :chapterId " +
                        "AND cts.slide_id = :slideId " +
                        "AND cts.status != 'DELETED'", nativeQuery = true)
        Optional<ChapterToSlides> findByChapterIdAndSlideId(@Param("chapterId") String chapterId,
                        @Param("slideId") String slideId);

        @Query("SELECT cts FROM ChapterToSlides cts " +
                        "WHERE cts.chapter.id = :chapterId " +
                        "AND cts.slide.id IN (:slideIds) AND cts.status != 'DELETED'")
        List<ChapterToSlides> findMappingsByChapterIdAndSlideIds(
                        @Param("chapterId") String chapterId,
                        @Param("slideIds") List<String> slideIds);

        @Query("SELECT cts FROM ChapterToSlides cts WHERE cts.chapter.id = :chapterId AND cts.status <> 'DELETED'")
        List<ChapterToSlides> findByChapterId(@Param("chapterId") String chapterId);

        @Query(value = """
                        SELECT cts.* FROM chapter_to_slides cts
                        WHERE cts.slide_id = :slideId ORDER BY cts.created_at DESC LIMIT 1
                        """, nativeQuery = true)
        Optional<ChapterToSlides> findBySlideId(@Param("slideId") String slideId);

        @Query(value = """
                        SELECT MAX(cts.slide_order) FROM chapter_to_slides cts
                        WHERE cts.chapter_id = :chapterId AND cts.status != 'DELETED'
                        """, nativeQuery = true)
        Integer findMaxSlideOrderByChapterId(@Param("chapterId") String chapterId);

}
