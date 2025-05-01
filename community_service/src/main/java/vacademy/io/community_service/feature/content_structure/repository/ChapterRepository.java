package vacademy.io.community_service.feature.content_structure.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.content_structure.entity.Chapter;
import vacademy.io.community_service.feature.content_structure.entity.Levels;
import vacademy.io.community_service.feature.content_structure.entity.Topic;

import java.util.List;

@Repository
public interface ChapterRepository extends JpaRepository<Chapter, String> {

    @Query(value = """
        SELECT c.* FROM chapter c
        JOIN subject_chapter_mapping scm ON c.chapter_id = scm.chapter_id
        WHERE scm.subject_id = :subjectId
        """, nativeQuery = true)
    List<Chapter> findChaptersOdSubject(@Param("subjectId") String subjectId);
}
