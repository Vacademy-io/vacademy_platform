package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectModuleMapping;
import vacademy.io.common.institute.entity.module.Module;

import java.util.List;

@Repository
public interface SubjectModuleMappingRepository extends JpaRepository<SubjectModuleMapping,String> {
    @Query("SELECT smm.module FROM SubjectModuleMapping smm " +
            "WHERE smm.subject.id = :subjectId " +
            "AND smm.module.status != 'DELETED'")
    List<Module> findModulesBySubjectIdAndStatusNotDeleted(String subjectId);
}
