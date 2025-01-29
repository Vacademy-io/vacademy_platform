package vacademy.io.admin_core_service.features.packages.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.common.institute.entity.PackageInstitute;

public interface PackageInstituteRepository extends JpaRepository<PackageInstitute, String> {
}
