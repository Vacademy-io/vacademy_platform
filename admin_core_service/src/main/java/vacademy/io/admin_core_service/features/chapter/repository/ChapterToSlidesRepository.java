package vacademy.io.admin_core_service.features.chapter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;

import java.util.Optional;

public interface ChapterToSlidesRepository extends JpaRepository<ChapterToSlides, String> {

    @Query(value = "SELECT * FROM chapter_to_slides cts " +
            "WHERE cts.chapter_id = :chapterId " +
            "AND cts.slide_id = :slideId " +
            "AND cts.status != 'DELETED'",
            nativeQuery = true)
    Optional<ChapterToSlides> findByChapterIdAndSlideId(@Param("chapterId") String chapterId,
                                                        @Param("slideId") String slideId);
}
