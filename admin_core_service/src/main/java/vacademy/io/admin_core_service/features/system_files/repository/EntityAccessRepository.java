package vacademy.io.admin_core_service.features.system_files.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.system_files.entity.EntityAccess;

import java.util.List;

@Repository
public interface EntityAccessRepository extends JpaRepository<EntityAccess, String> {

        List<EntityAccess> findByEntityAndEntityId(String entity, String entityId);

        void deleteByEntityAndEntityId(String entity, String entityId);

        // Find all access records for a specific level and levelId
        @Query("SELECT ea FROM EntityAccess ea WHERE ea.entity = :entity AND ea.level = :level AND ea.levelId = :levelId")
        List<EntityAccess> findByEntityAndLevelAndLevelId(
                        @Param("entity") String entity,
                        @Param("level") String level,
                        @Param("levelId") String levelId);

        // Find all access records for a specific level, levelId, and accessType
        @Query("SELECT ea FROM EntityAccess ea WHERE ea.entity = :entity AND ea.level = :level AND ea.levelId = :levelId AND ea.accessType = :accessType")
        List<EntityAccess> findByEntityAndLevelAndLevelIdAndAccessType(
                        @Param("entity") String entity,
                        @Param("level") String level,
                        @Param("levelId") String levelId,
                        @Param("accessType") String accessType);
}
