package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.common.institute.entity.module.Module;

public interface ModuleRepository extends JpaRepository<Module, String> {

}
