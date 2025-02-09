package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;

import java.util.List;

public interface ModuleChapterMappingRepository extends JpaRepository<ModuleChapterMapping,String> {
    @Query("SELECT mcm.chapter FROM ModuleChapterMapping mcm " +
            "WHERE mcm.module.id = :moduleId " +
            "AND mcm.chapter.status != 'DELETED' " +
            "AND NOT EXISTS (SELECT 1 FROM ChapterPackageSessionMapping cpsm " +
            "                WHERE cpsm.chapter.id = mcm.chapter.id " +
            "                AND cpsm.status = 'DELETED' " +
            "                AND cpsm.packageSession.id = :packageSessionId)")
    List<Chapter> findChaptersByModuleIdAndStatusNotDeleted(String moduleId, String packageSessionId);

}
