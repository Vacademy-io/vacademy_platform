package vacademy.io.community_service.feature.content_structure.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.content_structure.entity.Chapter;

import java.util.List;

@Repository
public interface ChapterRepository extends JpaRepository<Chapter, String> {

    @Query(value = """
        SELECT c.* FROM chapter c
        JOIN subject_chapter_mapping scm ON c.chapter_id = scm.chapter_id
        WHERE scm.subject_id = :subjectId AND scm.stream_id = :streamId
        """, nativeQuery = true)
    List<Chapter> findChaptersOfSubject(@Param("subjectId") String subjectId, @Param("streamId") String streamId);

    // insert chapter to subject and stream native query
    @Modifying
    @Transactional
    @Query(value = """
        INSERT INTO subject_chapter_mapping (subject_id, stream_id, chapter_id)
        VALUES (:subjectId, :streamId, :chapterId)
        """, nativeQuery = true)
    void addChapterToSubject(@Param("subjectId") String subjectId, @Param("streamId") String streamId, @Param("chapterId") String chapterId);
}
