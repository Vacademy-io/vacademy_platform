package vacademy.io.assessment_service.features.tags.entities.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.tags.entities.CommunityTag;

public interface TagCommunityRepository extends JpaRepository<CommunityTag, String> {

    @Query(value = "WITH new_tag AS (" +
            "  INSERT INTO tags (tag_id, tag_name, created_at, updated_at) " +
            "  SELECT :tagId, :tagName, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP " +
            "  WHERE NOT EXISTS (SELECT 1 FROM tags WHERE tag_name = :tagName) " +
            "  RETURNING tag_id" +
            ") " +
            "SELECT tag_id FROM new_tag " +
            "UNION ALL " +
            "SELECT tag_id FROM tags WHERE tag_name = :tagName " +
            "LIMIT 1",
            nativeQuery = true)
    String insertTagIfNotExists(@Param("tagId") String tagId,
                                @Param("tagName") String tagName);
}
