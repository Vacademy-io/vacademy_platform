package vacademy.io.community_service.feature.filter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.filter.entity.EntityTags;

import java.util.List;

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

//    @Query("SELECT e FROM EntityTags e")
//    List<EntityTags> findAllEntities();

}
