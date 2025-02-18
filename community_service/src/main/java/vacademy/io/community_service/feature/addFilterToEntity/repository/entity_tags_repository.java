package vacademy.io.community_service.feature.addFilterToEntity.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.addFilterToEntity.entity.entity_tags;
@Repository
public interface entity_tags_repository extends JpaRepository<entity_tags, String> {
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
}
