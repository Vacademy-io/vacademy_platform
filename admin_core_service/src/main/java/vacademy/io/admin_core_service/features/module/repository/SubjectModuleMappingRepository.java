package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.common.institute.entity.module.Module;

import java.util.List;

@Repository
public interface SubjectModuleMappingRepository extends JpaRepository<SubjectModuleMapping,String> {
    @Query("SELECT smm.module FROM SubjectModuleMapping smm " +
            "WHERE smm.subject.id = :subjectId " +
            "AND smm.module.status != 'DELETED' " +
            "ORDER BY smm.moduleOrder ASC NULLS LAST")
    List<Module> findModulesBySubjectIdAndStatusNotDeleted(String subjectId);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.subject.id IN :subjectIds AND smm.module.id IN :moduleIds")
    List<SubjectModuleMapping> findAllBySubjectIdInAndModuleIdIn(@Param("subjectIds") List<String> subjectIds, @Param("moduleIds") List<String> moduleIds);
}
