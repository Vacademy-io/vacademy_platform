package vacademy.io.admin_core_service.features.chapter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;

public interface ChapterToSlidesRepository extends JpaRepository<ChapterToSlides, String> {
}
