package vacademy.io.admin_core_service.features.chapter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;

@Repository
public interface ChapterRepository extends JpaRepository<Chapter,String> {
}
