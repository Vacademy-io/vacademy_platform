package vacademy.io.community_service.feature.filter.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.filter.entity.EntityTags;
import vacademy.io.community_service.feature.filter.entity.QuestionPaper;
import vacademy.io.community_service.feature.question_bank.dto.TagsByIdResponseDto;

import java.util.List;
import java.util.Map;

@Repository
public interface EntityTagsRepository extends JpaRepository<EntityTags, String>, JpaSpecificationExecutor<EntityTags> {
    @Modifying
    @Query(value = "INSERT INTO entity_tags (entity_id, entity_name, tag_id, tag_source) " +
            "VALUES (:entityId, :entityName, :tagId, :tagSource) " +
            "ON CONFLICT (entity_id, entity_name, tag_id) DO NOTHING",
            nativeQuery = true)
    void insertIgnoreConflict(
            @Param("entityId") String entityId,
            @Param("entityName") String entityName,
            @Param("tagId") String tagId,
            @Param("tagSource") String tagSource
    );

    @Query("SELECT DISTINCT et.id.entityId, et.id.entityName FROM EntityTags et " +
            "WHERE (:entityName IS NULL OR et.id.entityName = :entityName) " +
            "AND (:tagIds IS NULL OR et.id.tagId IN :tagIds)")
    Page<Object[]> findDistinctEntityIds(
            @Param("entityName") String entityName,
            @Param("tagIds") List<String> tagIds,
            Pageable pageable
    );

    @Query("""
    SELECT new vacademy.io.community_service.feature.question_bank.dto.TagsByIdResponseDto(
        e.id.tagId,
        e.tagSource,
        CASE
            WHEN e.tagSource = 'LEVEL' THEN l.levelName
            WHEN e.tagSource = 'STREAM' THEN s.streamName
            WHEN e.tagSource = 'SUBJECT' THEN sub.subjectName
            WHEN e.tagSource = 'DIFFICULTY' THEN e.id.tagId
            ELSE NULL
        END
    )
    FROM EntityTags e
    LEFT JOIN Levels l ON e.id.tagId = l.levelId AND e.tagSource = 'LEVEL'
    LEFT JOIN Streams s ON e.id.tagId = s.streamId AND e.tagSource = 'STREAM'
    LEFT JOIN Subjects sub ON e.id.tagId = sub.subjectId AND e.tagSource = 'SUBJECT'
    WHERE e.id.entityId = :entityId
""")
    List<TagsByIdResponseDto> findTagsByEntityId(@Param("entityId") String entityId);

    @Query("""
    SELECT qp
    FROM QuestionPaper qp
    WHERE qp.id = :entityId
""")
    QuestionPaper findQuestionPaperByEntityId(@Param("entityId") String entityId);
}
