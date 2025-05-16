package vacademy.io.community_service.feature.content_structure.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.content_structure.entity.Chapter;
import vacademy.io.community_service.feature.content_structure.entity.Topic;

import java.util.List;

@Repository
public interface TopicRepository extends JpaRepository<Topic, String> {

    @Query(value = """
        SELECT t.* FROM topic t
        JOIN chapter_topic_mapping ctm ON t.topic_id = ctm.topic_id
        WHERE ctm.chapter_id IN :chapterIds
        """, nativeQuery = true)
    List<Topic> findTopicsByChapterId(@Param("chapterIds") List<String> chapterIds);
}
