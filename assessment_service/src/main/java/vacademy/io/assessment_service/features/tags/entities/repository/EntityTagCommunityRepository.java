package vacademy.io.assessment_service.features.tags.entities.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.assessment_service.features.tags.entities.EntityTag;

import java.util.List;

public interface EntityTagCommunityRepository extends JpaRepository<EntityTag, String> {

    // Idempotent link of a tag to an entity; safe to call repeatedly (e.g. re-save).
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO entity_tags (entity_id, entity_name, tag_id, tag_source, created_at, updated_at) " +
            "VALUES (:entityId, :entityName, :tagId, :tagSource, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
            "ON CONFLICT (entity_name, entity_id, tag_id) DO NOTHING",
            nativeQuery = true)
    void insertIgnoreConflict(@Param("entityId") String entityId,
                              @Param("entityName") String entityName,
                              @Param("tagId") String tagId,
                              @Param("tagSource") String tagSource);

    // Batch-load SUBJECT tags for a set of questions (read-back on get-by-id; avoids N+1).
    @Query(value = "SELECT et.entity_id AS questionId, t.tag_id AS tagId, t.tag_name AS tagName " +
            "FROM entity_tags et JOIN tags t ON et.tag_id = t.tag_id " +
            "WHERE et.entity_name = 'QUESTION' AND et.tag_source = 'SUBJECT' " +
            "AND et.entity_id IN (:questionIds)",
            nativeQuery = true)
    List<Object[]> findSubjectTagsForQuestions(@Param("questionIds") List<String> questionIds);

    // Clear existing SUBJECT tag links for the given questions before re-adding (replace-on-save).
    // Scoped to SUBJECT source so AI 'TAGS'/'TOPIC' links are untouched.
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM entity_tags WHERE entity_name = 'QUESTION' " +
            "AND tag_source = 'SUBJECT' AND entity_id IN (:questionIds)",
            nativeQuery = true)
    void deleteSubjectTagsForQuestions(@Param("questionIds") List<String> questionIds);
}
