package vacademy.io.admin_core_service.features.subject.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectChapterModuleAndPackageSessionMapping;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;

@Repository
public interface SubjectChapterModuleAndPackageSessionMappingRepository extends JpaRepository<SubjectChapterModuleAndPackageSessionMapping, String> {

}
