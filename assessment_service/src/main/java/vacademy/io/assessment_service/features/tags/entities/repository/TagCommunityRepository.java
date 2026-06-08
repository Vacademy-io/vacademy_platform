package vacademy.io.assessment_service.features.tags.entities.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.tags.entities.CommunityTag;

import java.util.List;

public interface TagCommunityRepository extends JpaRepository<CommunityTag, String> {

    // Institute-scoped upsert: a tag name is unique per institute (see uq_tags_institute_name).
    // Returns the existing tag_id for (instituteId, tagName) or the newly inserted one.
    @Query(value = "WITH new_tag AS (" +
            "  INSERT INTO tags (tag_id, tag_name, institute_id, created_at, updated_at) " +
            "  SELECT :tagId, :tagName, :instituteId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP " +
            "  WHERE NOT EXISTS (SELECT 1 FROM tags WHERE tag_name = :tagName AND institute_id = :instituteId) " +
            "  RETURNING tag_id" +
            ") " +
            "SELECT tag_id FROM new_tag " +
            "UNION ALL " +
            "SELECT tag_id FROM tags WHERE tag_name = :tagName AND institute_id = :instituteId " +
            "LIMIT 1",
            nativeQuery = true)
    String insertTagIfNotExists(@Param("tagId") String tagId,
                                @Param("tagName") String tagName,
                                @Param("instituteId") String instituteId);

    // Tag vocabulary for an institute (autocomplete in upload tagging + assessment filter).
    @Query(value = "SELECT tag_id AS tagId, tag_name AS tagName FROM tags " +
            "WHERE institute_id = :instituteId " +
            "AND (:search IS NULL OR tag_name ILIKE CONCAT('%', :search, '%')) " +
            "ORDER BY tag_name",
            nativeQuery = true)
    List<Object[]> findTagsByInstitute(@Param("instituteId") String instituteId,
                                       @Param("search") String search);
}
