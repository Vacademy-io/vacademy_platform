package vacademy.io.admin_core_service.features.module.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.institute.entity.module.Module;

public interface ModuleRepository extends JpaRepository<Module,String> {
}
