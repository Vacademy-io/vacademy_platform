package vacademy.io.admin_core_service.features.faculty.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;

public interface FacultySubjectPackageSessionMappingRepository extends JpaRepository<FacultySubjectPackageSessionMapping,String> {
}
