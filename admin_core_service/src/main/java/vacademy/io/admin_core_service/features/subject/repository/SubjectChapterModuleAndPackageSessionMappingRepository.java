package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.subject.entity.SubjectChapterModuleAndPackageSessionMapping;
import vacademy.io.common.institute.entity.module.Module;

import java.util.List;

@Repository
public interface SubjectChapterModuleAndPackageSessionMappingRepository extends JpaRepository<SubjectChapterModuleAndPackageSessionMapping, String> {
    @Query("SELECT DISTINCT m.module FROM SubjectChapterModuleAndPackageSessionMapping m " +
            "WHERE m.subject.id = :subjectId " +
            "AND m.module.status = 'ACTIVE'")
    List<Module> findActiveModulesByActiveSubjectId(@Param("subjectId") String subjectId);

    @Query("SELECT DISTINCT m.chapter FROM SubjectChapterModuleAndPackageSessionMapping m " +
            "WHERE m.module.id = :moduleId " +
            "AND m.chapter.status = 'ACTIVE'")
    List<Chapter> findActiveChaptersByModuleId(@Param("moduleId") String moduleId);

}
