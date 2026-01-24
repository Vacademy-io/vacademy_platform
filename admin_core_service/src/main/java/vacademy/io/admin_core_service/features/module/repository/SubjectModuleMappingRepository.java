package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.common.institute.entity.module.Module;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectModuleMappingRepository extends JpaRepository<SubjectModuleMapping, String> {
    @Query("SELECT smm.module FROM SubjectModuleMapping smm " +
            "JOIN smm.subject s " +
            "JOIN SubjectPackageSession sps ON sps.subject.id = s.id " +
            "JOIN sps.packageSession ps " +
            "WHERE sps.subject.id = :subjectId " +
            "AND ps.id = :packageSessionId " +
            "AND smm.module.status != 'DELETED' AND s.status != 'DELETED' AND ps.status != 'DELETED' " +
            "ORDER BY smm.moduleOrder ASC NULLS LAST")
    List<Module> findModulesBySubjectIdAndPackageSessionId(String subjectId, String packageSessionId);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.subject.id IN :subjectIds AND smm.module.id IN :moduleIds")
    List<SubjectModuleMapping> findAllBySubjectIdInAndModuleIdIn(@Param("subjectIds") List<String> subjectIds,
            @Param("moduleIds") List<String> moduleIds);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.module.id = :moduleId")
    Optional<SubjectModuleMapping> findByModuleId(@Param("moduleId") String moduleId);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.module.id = :moduleId")
    List<SubjectModuleMapping> findAllByModuleId(@Param("moduleId") String moduleId);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.module.id = :moduleId AND smm.subject.id = :subjectId")
    Optional<SubjectModuleMapping> findByModuleIdAndSubjectId(@Param("moduleId") String moduleId,
            @Param("subjectId") String subjectId);

    @Query("""
                SELECT smm FROM SubjectModuleMapping smm
                WHERE smm.subject.id = :subjectId
                AND LOWER(smm.module.moduleName) = LOWER(:moduleName)
                AND smm.module.status <> 'DELETED'
            """)
    Optional<SubjectModuleMapping> findBySubjectIdAndModuleName(
            @Param("subjectId") String subjectId,
            @Param("moduleName") String moduleName);

    @Query("""
                SELECT smm FROM SubjectModuleMapping smm
                WHERE smm.subject.id = :subjectId
                AND LOWER(smm.module.moduleName) = LOWER(:moduleName)
                AND smm.module.status <> 'DELETED'
            """)
    List<SubjectModuleMapping> findAllBySubjectIdAndModuleName(
            @Param("subjectId") String subjectId,
            @Param("moduleName") String moduleName);

    @Query("SELECT smm FROM SubjectModuleMapping smm WHERE smm.subject.id = :subjectId")
    List<SubjectModuleMapping> findBySubjectId(@Param("subjectId") String subjectId);

    @Query("SELECT MAX(smm.moduleOrder) FROM SubjectModuleMapping smm WHERE smm.subject.id = :subjectId")
    Integer findMaxModuleOrderBySubjectId(@Param("subjectId") String subjectId);

}