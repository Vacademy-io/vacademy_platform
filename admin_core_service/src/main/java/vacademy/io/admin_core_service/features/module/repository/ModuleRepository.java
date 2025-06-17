package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.common.institute.entity.module.Module;

import java.util.List;
import java.util.Optional;

public interface ModuleRepository extends JpaRepository<Module, String> {

    @Query(value = """
    SELECT m.*
    FROM modules m
    JOIN module_chapter_mapping mcm ON mcm.module_id = m.id
    JOIN chapter c ON c.id = mcm.chapter_id
    JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id
    JOIN chapter_to_slides cts ON cts.chapter_id = c.id
    WHERE cts.slide_id = :slideId
      AND cpsm.package_session_id = :packageSessionId
      AND cts.status IN (:chapterToSlideStatusList)
      AND cpsm.status IN (:chapterToPackageSessionStatusList)
      AND m.status IN (:moduleStatusList) LIMIT 1
    """, nativeQuery = true)
    Optional<Module> findModuleBySlideIdAndPackageSessionIdWithStatusFilters(
            @Param("slideId") String slideId,
            @Param("packageSessionId") String packageSessionId,
            @Param("chapterToSlideStatusList") List<String> chapterToSlideStatusList,
            @Param("chapterToPackageSessionStatusList") List<String> chapterToPackageSessionStatusList,
            @Param("moduleStatusList") List<String> moduleStatusList
    );

}
