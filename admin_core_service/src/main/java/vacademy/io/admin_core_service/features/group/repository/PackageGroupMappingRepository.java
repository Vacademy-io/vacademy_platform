package vacademy.io.admin_core_service.features.group.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.group.entity.PackageGroupMapping;

public interface PackageGroupMappingRepository extends JpaRepository<PackageGroupMapping, String> {
}
